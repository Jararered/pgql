#include "json_protocol.h"
#include <assert.h>
#include <string.h>
int main(void) {
  const char *valid[]={"null","true","false","0","-0","-2.5e+4","[]","{}","{\"type\":\"command\",\"args\":[1,true,null]}","\"\\u0041\\n\\\\\\\"\""," \n [ {\"a\": []} ] \r"};
  const char *invalid[]={""," ","01","+1","1.","1e","NaN","TRUE","{a:1}","{\"a\":}","[1,]","{\"a\":1,}","null false","\"\\x41\"","\"\\u0XX1\"","\"unterminated","\"raw\nline\""};
  for(unsigned i=0;i<sizeof valid/sizeof *valid;i++)assert(framework_json_valid(valid[i],strlen(valid[i])));
  for(unsigned i=0;i<sizeof invalid/sizeof *invalid;i++)assert(!framework_json_valid(invalid[i],strlen(invalid[i])));
  const char nul[]={'"','\\',0,'"'};assert(!framework_json_valid(nul,sizeof nul));
  char deep[140];memset(deep,'[',70);memset(deep+70,']',70);assert(!framework_json_valid(deep,sizeof deep));
  return 0;
}
