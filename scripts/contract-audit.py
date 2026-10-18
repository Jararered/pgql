#!/usr/bin/env python3
"""Run the PGQL contract audit against the game on the connected phone.

Usage: python3 scripts/contract-audit.py [--pgp] [--out FILE] [--script FILE]

Attaches the installed PGQL runner to the running game (the :pgp accessory
process with --pgp), asks the diagnostics module for {action:'contracts'},
writes the report to build/contracts-<game version>[-pgp].json and detaches.
The audit binds every adapter on whatever build is installed but installs no
adapter hook; compare the report with scripts/contract-diff.py.

Preconditions (see AGENTS.md): no other PGQL runner attached, the game started
fresh and sent to the background. Defaults to the bundled agent
app/src/main/assets/agent.js, so run python3 scripts/build.py first.
"""
import argparse,json,subprocess,sys,threading,time
from pathlib import Path

root=Path(__file__).resolve().parents[1]
game='com.nianticlabs.pokemongo'
controller='dev.qol.framework'
remote='/data/local/tmp/pgql-audit.js'

def adb(*args,check=True):
  return subprocess.run(['adb',*args],check=check,capture_output=True,text=True).stdout.strip()

def main():
  parser=argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
  parser.add_argument('--pgp',action='store_true',help='audit the :pgp accessory process (GO Plus exports only)')
  parser.add_argument('--out',help='report path (default build/contracts-<version>.json)')
  parser.add_argument('--script',default=str(root/'app/src/main/assets/agent.js'))
  parser.add_argument('--timeout',type=float,default=120)
  args=parser.parse_args()
  if adb('shell','pidof','libqolrunner.so',check=False):
    raise SystemExit('A PGQL runner is already attached; stop that session first (one runner at a time).')
  process=game+(':pgp' if args.pgp else '')
  pid=adb('shell','pidof',process,check=False).split()
  if len(pid)!=1:raise SystemExit('Expected one running '+process+' process; start the game first.')
  apk=adb('shell','pm','path',controller).split('package:')[-1].strip()
  if not apk:raise SystemExit(controller+' is not installed; install build/pgql-debug.apk')
  runner=apk.rsplit('/',1)[0]+'/lib/arm64/libqolrunner.so'
  script=Path(args.script).read_text()
  # The :pgp companion is told its role the same way SessionService does it.
  local=root/'build/contract-audit-agent.js';local.parent.mkdir(exist_ok=True)
  local.write_text(("globalThis.PgqlRole='pgp';\n" if args.pgp else '')+script)
  adb('push',str(local),remote)
  log=root/('build/contract-audit%s.jsonl'%('-pgp' if args.pgp else ''))
  child=subprocess.Popen(['adb','shell','su','-c',f'"exec {runner} --pid {pid[0]} --script {remote} --resident-agent"'],
    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
  state={'ready':False,'report':None,'error':None}
  def read():
    with open(log,'w') as out:
      for line in child.stdout:
        out.write(line)
        try:event=json.loads(line)
        except ValueError:continue
        payload=event.get('message',{}).get('payload',{})
        if payload.get('type')=='agent-ready':state['ready']=True
        elif payload.get('type')=='response' and payload.get('id')=='contract-audit':
          if payload.get('ok'):state['report']=payload['result']
          else:state['error']=payload.get('error')
        elif event.get('event')=='error':print('runner: '+line.strip(),file=sys.stderr)
  reader=threading.Thread(target=read,daemon=True);reader.start()
  send=message=>(child.stdin.write(json.dumps(message)+'\n'),child.stdin.flush())
  try:
    deadline=time.monotonic()+args.timeout
    while not state['ready']:
      if child.poll() is not None or time.monotonic()>deadline:raise SystemExit('Runner did not become ready; see '+str(log.relative_to(root)))
      time.sleep(0.2)
    send({'type':'command','id':'contract-audit','moduleId':'diagnostics','action':'invoke','args':{'action':'contracts'}})
    while state['report'] is None and state['error'] is None:
      if child.poll() is not None or time.monotonic()>deadline:raise SystemExit('No audit result; see '+str(log.relative_to(root)))
      time.sleep(0.2)
  finally:
    if child.poll() is None:
      try:send({'type':'command','id':'shutdown','action':'shutdown'});time.sleep(1);child.stdin.close()
      except (BrokenPipeError,ValueError):pass
      try:child.wait(timeout=20)
      except subprocess.TimeoutExpired:child.terminate()
  if state['error']:raise SystemExit('Audit failed: '+state['error'])
  report=state['report']
  out=Path(args.out) if args.out else root/('build/contracts-%s%s.json'%(report.get('game') or 'unknown','-pgp' if args.pgp else ''))
  out.write_text(json.dumps(report,indent=1,sort_keys=True)+'\n')
  print('Game %s (PGQL verified for %s): %s'%(report.get('game'),report.get('supported'),'all contracts bind' if report.get('ok') else 'failed: '+', '.join(report.get('failed',[]))))
  print('Report: '+str(out))
  return 0 if report.get('ok') else 1

if __name__=='__main__':sys.exit(main())
