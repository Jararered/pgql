#include "json_protocol.h"
#include <string.h>
typedef struct { const char *p, *end; } Parser;
static void ws(Parser *p) { while(p->p<p->end && (*p->p==' ' || *p->p=='\t' || *p->p=='\n' || *p->p=='\r')) p->p++; }
static int string(Parser *p) {
  if(p->p==p->end || *p->p++!='"') return 0;
  while(p->p<p->end) {
    unsigned char c=(unsigned char)*p->p++;
    if(c=='"') return 1;
    if(c<32) return 0;
    if(c=='\\') {
      if(p->p==p->end) return 0;
      c=(unsigned char)*p->p++;
      if(c=='u') { for(int i=0;i<4;i++) { if(p->p==p->end) return 0; c=(unsigned char)*p->p++; if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F'))) return 0; } }
      else if(c==0 || !strchr("\"\\/bfnrt",c)) return 0;
    }
  }
  return 0;
}
static int digit(Parser *p) { return p->p<p->end && *p->p>='0' && *p->p<='9'; }
static int number(Parser *p) {
  if(p->p<p->end && *p->p=='-') p->p++;
  if(!digit(p)) return 0;
  if(*p->p=='0') p->p++; else while(digit(p)) p->p++;
  if(p->p<p->end && *p->p=='.') { p->p++; if(!digit(p)) return 0; while(digit(p)) p->p++; }
  if(p->p<p->end && (*p->p=='e'||*p->p=='E')) { p->p++; if(p->p<p->end&&(*p->p=='+'||*p->p=='-'))p->p++; if(!digit(p))return 0; while(digit(p))p->p++; }
  return 1;
}
static int value(Parser *p,unsigned depth) {
  ws(p); if(p->p==p->end || depth>64) return 0;
  if(*p->p=='"')return string(p);
  if(*p->p=='{'||*p->p=='[') {
    char open=*p->p++,close=open=='{'?'}':']'; ws(p);
    if(p->p<p->end&&*p->p==close){p->p++;return 1;}
    for(;;) {
      if(open=='{') { if(!string(p))return 0;ws(p);if(p->p==p->end||*p->p++!=':')return 0; }
      if(!value(p,depth+1))return 0;ws(p);if(p->p==p->end)return 0;
      if(*p->p==close){p->p++;return 1;}if(*p->p++!=',')return 0;ws(p);
    }
  }
  const char *literals[]={"true","false","null"};
  for(unsigned i=0;i<3;i++){size_t n=strlen(literals[i]);if((size_t)(p->end-p->p)>=n&&!memcmp(p->p,literals[i],n)){p->p+=n;return 1;}}
  return number(p);
}
int framework_json_valid(const char *text,size_t length) { Parser p={text,text+length};if(!value(&p,0))return 0;ws(&p);return p.p==p.end; }
