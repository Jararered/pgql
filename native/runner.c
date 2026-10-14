#define _POSIX_C_SOURCE 200809L
#include "frida-core.h"
#include "json_protocol.h"
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define MAX_COMMAND (1024u * 1024u)
#define MAX_SCRIPT (16u * 1024u * 1024u)
static GMainLoop *loop;
static FridaScript *script;
static GMutex output_lock;
static int signal_pipe[2] = {-1,-1};
static volatile sig_atomic_t stop_requested;
static gboolean detached, shutting_down, shutdown_waiting, shutdown_acknowledged;
static int exit_status;
static GString *input;

static void quote(const char *s) {
  fputc('"',stdout);
  for(const unsigned char *p=(const unsigned char *)s;*p;p++) {
    switch(*p) {
      case '"':fputs("\\\"",stdout);break;case '\\':fputs("\\\\",stdout);break;
      case '\n':fputs("\\n",stdout);break;case '\r':fputs("\\r",stdout);break;case '\t':fputs("\\t",stdout);break;
      default:if(*p<32)fprintf(stdout,"\\u%04x",*p);else fputc(*p,stdout);
    }
  }
  fputc('"',stdout);
}
static void finish_event(void) { fputs("}\n",stdout);if(fflush(stdout)==EOF && loop)g_main_loop_quit(loop);g_mutex_unlock(&output_lock); }
static void error_event(const char *stage,const char *message) {
  g_mutex_lock(&output_lock);fputs("{\"event\":\"error\",\"stage\":",stdout);quote(stage);fputs(",\"message\":",stdout);quote(message);finish_event();
}
static gboolean json_string_equals(JsonObject *object,const char *member,const char *expected) {
  JsonNode *node=json_object_get_member(object,member);
  return node && JSON_NODE_HOLDS_VALUE(node) && json_node_get_value_type(node)==G_TYPE_STRING &&
      g_strcmp0(json_node_get_string(node),expected)==0;
}
static gboolean is_shutdown_acknowledgement(const char *message) {
  JsonParser *parser=json_parser_new();gboolean matched=FALSE;
  if(json_parser_load_from_data(parser,message,-1,NULL)) {
    JsonNode *root=json_parser_get_root(parser);
    if(root && JSON_NODE_HOLDS_OBJECT(root)) {
      JsonObject *envelope=json_node_get_object(root);
      JsonNode *payload=json_object_get_member(envelope,"payload");
      if(json_string_equals(envelope,"type","send") && payload && JSON_NODE_HOLDS_OBJECT(payload)) {
        JsonObject *body=json_node_get_object(payload);
        matched=json_string_equals(body,"type","shutdown-complete") && json_string_equals(body,"id","native-shutdown");
      }
    }
  }
  g_object_unref(parser);return matched;
}
static gboolean shutdown_timeout(gpointer unused) {
  (void)unused;g_main_loop_quit(loop);return G_SOURCE_REMOVE;
}
static void on_message(FridaScript *sender,const gchar *message,GBytes *data,gpointer unused) {
  (void)sender;(void)unused;
  if(shutdown_waiting && is_shutdown_acknowledgement(message))shutdown_acknowledged=TRUE;
  g_mutex_lock(&output_lock);fputs("{\"event\":\"message\",\"message\":",stdout);fputs(message,stdout);
  if(data) { gsize size;const guchar *bytes=g_bytes_get_data(data,&size);gchar *encoded=g_base64_encode(bytes,size);fputs(",\"data_base64\":",stdout);quote(encoded);g_free(encoded); }
  finish_event();
  if(shutdown_waiting && shutdown_acknowledged)g_main_loop_quit(loop);
}
static void on_detached(FridaSession *session,FridaSessionDetachReason reason,FridaCrash *crash,gpointer unused) {
  (void)session;(void)unused;detached=TRUE;
  g_mutex_lock(&output_lock);fprintf(stdout,"{\"event\":\"detached\",\"reason\":%d,\"crashed\":%s",reason,crash?"true":"false");finish_event();
  if(!shutting_down)exit_status=3;
  g_main_loop_quit(loop);
}
static void on_signal(int number) {
  int saved=errno;stop_requested=number;
  if(signal_pipe[1]>=0) { unsigned char byte=(unsigned char)number;ssize_t ignored=write(signal_pipe[1],&byte,1);(void)ignored; }
  errno=saved;
}
static gboolean signal_ready(GIOChannel *channel,GIOCondition condition,gpointer unused) {
  (void)channel;(void)condition;(void)unused;g_main_loop_quit(loop);return G_SOURCE_REMOVE;
}
static gboolean post_line(void) {
  if(input->len && input->str[input->len-1]=='\r')g_string_truncate(input,input->len-1);
  if(!input->len)return TRUE;
  if(!g_utf8_validate(input->str,input->len,NULL)||!framework_json_valid(input->str,input->len)) {
    error_event("stdin","Expected one UTF-8 JSON value per line");return TRUE;
  }
  if(script&&!detached)frida_script_post(script,input->str,NULL);
  return TRUE;
}
static gboolean stdin_ready(GIOChannel *channel,GIOCondition condition,gpointer unused) {
  (void)channel;(void)unused;
  if(condition&(G_IO_ERR|G_IO_NVAL)){error_event("stdin","Input pipe error");exit_status=2;g_main_loop_quit(loop);return G_SOURCE_REMOVE;}
  char buffer[4096];ssize_t size;
  while((size=read(STDIN_FILENO,buffer,sizeof buffer))>0) {
    for(ssize_t i=0;i<size;i++) {
      if(buffer[i]=='\n'){post_line();g_string_truncate(input,0);}
      else { if(input->len>=MAX_COMMAND){error_event("stdin","JSON line exceeds 1 MiB limit");exit_status=2;g_main_loop_quit(loop);return G_SOURCE_REMOVE;}g_string_append_c(input,buffer[i]); }
    }
  }
  if(size==0){post_line();g_main_loop_quit(loop);return G_SOURCE_REMOVE;}
  if(errno!=EAGAIN&&errno!=EWOULDBLOCK&&errno!=EINTR){error_event("stdin",strerror(errno));exit_status=2;g_main_loop_quit(loop);return G_SOURCE_REMOVE;}
  return G_SOURCE_CONTINUE;
}
static int nonblocking(int fd) { int flags=fcntl(fd,F_GETFL);return flags<0?-1:fcntl(fd,F_SETFL,flags|O_NONBLOCK); }
static void usage(void) { fprintf(stderr,"Usage: framework-runner --pid PID --script FILE [--prepare-selinux] [--resident-agent]\nStdin: one JSON message per line. EOF, SIGINT or SIGTERM detaches.\n--prepare-selinux explicitly applies Frida's system-wide runtime policy setup until reboot.\n--resident-agent shuts down modules but keeps the inert agent resident until target exit.\n"); }
int main(int argc,char **argv) {
  guint pid=0;const char *path=NULL;gchar *source=NULL;gsize source_size=0;GError *error=NULL;
  FridaDeviceManager *manager=NULL;FridaDevice *device=NULL;FridaSession *session=NULL;FridaScriptOptions *options=NULL;
  GIOChannel *stdin_channel=NULL,*signal_channel=NULL;guint stdin_watch=0,signal_watch=0;
  int stdin_flags=-1;gboolean loaded=FALSE,prepare_selinux=FALSE,resident_agent=FALSE;
  for(int i=1;i<argc;i++) {
    if(!strcmp(argv[i],"--pid")&&i+1<argc){char *end;errno=0;unsigned long parsed=strtoul(argv[++i],&end,10);if(errno||*end||!parsed||parsed>0x7fffffffUL){usage();return 2;}pid=(guint)parsed;}
    else if(!strcmp(argv[i],"--script")&&i+1<argc)path=argv[++i];
    else if(!strcmp(argv[i],"--prepare-selinux"))prepare_selinux=TRUE;
    else if(!strcmp(argv[i],"--resident-agent"))resident_agent=TRUE;
    else if(!strcmp(argv[i],"--help")){usage();return 0;}else{usage();return 2;}
  }
  if(!pid||!path){usage();return 2;}
  frida_init();g_mutex_init(&output_lock);loop=g_main_loop_new(NULL,FALSE);input=g_string_new(NULL);
  if(!g_file_get_contents(path,&source,&source_size,&error)){error_event("script-read",error->message);goto fail;}
  if(source_size>MAX_SCRIPT||memchr(source,0,source_size)||!g_utf8_validate(source,source_size,NULL)){error_event("script-read","Script must be UTF-8 text without NUL bytes, at most 16 MiB");goto fail;}
  if(pipe(signal_pipe)||nonblocking(signal_pipe[0])||nonblocking(signal_pipe[1])){error_event("signal-pipe",strerror(errno));goto fail;}
  struct sigaction action;memset(&action,0,sizeof action);action.sa_handler=on_signal;sigemptyset(&action.sa_mask);sigaction(SIGINT,&action,NULL);sigaction(SIGTERM,&action,NULL);signal(SIGPIPE,SIG_IGN);
  signal_channel=g_io_channel_unix_new(signal_pipe[0]);signal_watch=g_io_add_watch(signal_channel,G_IO_IN|G_IO_HUP|G_IO_ERR,signal_ready,NULL);
  stdin_flags=fcntl(STDIN_FILENO,F_GETFL);if(stdin_flags<0||nonblocking(STDIN_FILENO)){error_event("stdin",strerror(errno));goto fail;}
  stdin_channel=g_io_channel_unix_new(STDIN_FILENO);stdin_watch=g_io_add_watch(stdin_channel,G_IO_IN|G_IO_HUP|G_IO_ERR|G_IO_NVAL,stdin_ready,NULL);
  manager=frida_device_manager_new();
  if(prepare_selinux) {
    if(geteuid()!=0){error_event("selinux","Policy setup requires root");goto fail;}
    g_mutex_lock(&output_lock);fputs("{\"event\":\"policy-setup\",\"implementation\":\"frida_selinux_patch_policy\"",stdout);finish_event();
    frida_selinux_patch_policy();
  }
  device=frida_device_manager_get_device_by_type_sync(manager,FRIDA_DEVICE_TYPE_LOCAL,0,NULL,&error);
  if(!device){error_event("local-device",error->message);goto fail;}if(stop_requested)goto cleanup;
  session=frida_device_attach_sync(device,pid,NULL,NULL,&error);
  if(!session){error_event("attach",error->message);goto fail;}
  g_signal_connect(session,"detached",G_CALLBACK(on_detached),NULL);if(stop_requested)goto cleanup;
  options=frida_script_options_new();frida_script_options_set_name(options,"framework-module");frida_script_options_set_runtime(options,FRIDA_SCRIPT_RUNTIME_QJS);
  script=frida_session_create_script_sync(session,source,options,NULL,&error);
  if(!script){error_event("create-script",error->message);goto fail;}
  g_signal_connect(script,"message",G_CALLBACK(on_message),NULL);
  frida_script_load_sync(script,NULL,&error);if(error){error_event("load-script",error->message);goto fail;}loaded=TRUE;
  g_mutex_lock(&output_lock);fprintf(stdout,"{\"event\":\"ready\",\"pid\":%u,\"frida_hiding\":\"names-v1\"",pid);finish_event();
  if(!stop_requested&&!detached)g_main_loop_run(loop);
  goto cleanup;
fail:
  exit_status=2;
cleanup:
  shutting_down=TRUE;g_clear_error(&error);
  /* Prevent additional commands or the original signal source from ending the
   * bounded shutdown acknowledgement loop before the agent can clean up. */
  if(stdin_watch&&g_main_context_find_source_by_id(NULL,stdin_watch))g_source_remove(stdin_watch);
  stdin_watch=0;
  if(signal_watch&&g_main_context_find_source_by_id(NULL,signal_watch))g_source_remove(signal_watch);
  signal_watch=0;
  if(loaded&&!detached && resident_agent) {
    shutdown_waiting=TRUE;
    guint timeout=g_timeout_add(3000,shutdown_timeout,NULL);
    frida_script_post(script,"{\"type\":\"command\",\"action\":\"shutdown\",\"id\":\"native-shutdown\"}",NULL);
    if(!shutdown_acknowledged&&!detached)g_main_loop_run(loop);
    shutdown_waiting=FALSE;
    if(g_main_context_find_source_by_id(NULL,timeout))g_source_remove(timeout);
    if(!shutdown_acknowledged){error_event("agent-shutdown","No shutdown acknowledgement within 3 seconds; agent cleanup is unconfirmed");exit_status=2;}
    if(!detached) {
      /* Deliberately avoid the unload path even after a missing acknowledgement:
       * unloading is the compatibility issue this opt-in mode is addressing. */
      frida_script_eternalize_sync(script,NULL,&error);
      gboolean eternalized=error==NULL;
      if(error){error_event("eternalize-script",error->message);g_clear_error(&error);exit_status=2;}
      g_mutex_lock(&output_lock);
      fprintf(stdout,"{\"event\":\"resident-agent\",\"shutdown_acknowledged\":%s,\"eternalized\":%s",shutdown_acknowledged?"true":"false",eternalized?"true":"false");finish_event();
    }
  } else if(loaded&&!detached) {
    frida_script_unload_sync(script,NULL,&error);
    if(error){error_event("unload-script",error->message);g_clear_error(&error);exit_status=2;}
  }
  if(session&&!frida_session_is_detached(session)){frida_session_detach_sync(session,NULL,&error);if(error){error_event("detach",error->message);g_clear_error(&error);exit_status=2;}}
  if(manager){frida_device_manager_close_sync(manager,NULL,&error);if(error){error_event("manager-close",error->message);g_clear_error(&error);exit_status=2;}}
  if(stdin_watch&&g_main_context_find_source_by_id(NULL,stdin_watch))g_source_remove(stdin_watch);
  if(signal_watch&&g_main_context_find_source_by_id(NULL,signal_watch))g_source_remove(signal_watch);
  if(stdin_channel)g_io_channel_unref(stdin_channel);if(signal_channel)g_io_channel_unref(signal_channel);
  if(stdin_flags>=0)fcntl(STDIN_FILENO,F_SETFL,stdin_flags);
  signal_pipe[1]=-1; /* Prevent handler from writing after closing. */
  if(signal_pipe[0]>=0)close(signal_pipe[0]); /* Write fd kept until process exit to avoid reuse races. */
  g_clear_object(&script);g_clear_object(&options);g_clear_object(&session);g_clear_object(&device);g_clear_object(&manager);
  g_free(source);g_string_free(input,TRUE);g_main_loop_unref(loop);loop=NULL;g_mutex_clear(&output_lock);frida_deinit();return exit_status;
}
