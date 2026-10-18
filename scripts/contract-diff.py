#!/usr/bin/env python3
"""Compare two PGQL contract audit reports (contracts/<version>.json or build/contracts-*.json).

Usage: python3 scripts/contract-diff.py OLD NEW

Prints, per adapter, whether it still binds and which resolved members
changed, then the declared-member changes of every class an adapter uses. A
removed field and an added field of the same type in one class are shown as a
probable rename, which is what an obfuscated-name change looks like. Exit
status is 1 when NEW has an adapter or native contract that fails to bind.
"""
import json,sys
from pathlib import Path

def load(path):
  report=json.loads(Path(path).read_text())
  if report.get('schema')!=1:raise SystemExit(path+': unsupported contract report schema')
  return report

def split(signature):
  # 'static name:Type' -> ('static name','Type'); methods have no rename pairing.
  name,_,kind=signature.rpartition(':')
  return name,kind

def class_changes(name,old,new):
  lines=[]
  if old is None:return ['  + class '+name+' (newly used)']
  if new is None:return ['  - class '+name+' (no longer resolved)']
  if old.get('parent')!=new.get('parent'):lines.append('  ~ parent %s -> %s'%(old.get('parent'),new.get('parent')))
  removed=sorted(set(old.get('fields',[]))-set(new.get('fields',[])))
  added=sorted(set(new.get('fields',[]))-set(old.get('fields',[])))
  for signature in list(removed):
    field,kind=split(signature)
    same=[candidate for candidate in added if split(candidate)[1]==kind]
    if len(same)==1:
      lines.append('  ~ field %s -> %s : %s (probable rename)'%(field,split(same[0])[0],kind))
      removed.remove(signature);added.remove(same[0])
  lines+=['  - field '+s for s in removed]+['  + field '+s for s in added]
  old_methods,new_methods=old.get('methods',[]),new.get('methods',[])
  lines+=['  - method '+s for s in sorted(set(old_methods)-set(new_methods))]
  lines+=['  + method '+s for s in sorted(set(new_methods)-set(old_methods))]
  return lines

def main():
  if len(sys.argv)!=3:raise SystemExit(__doc__)
  old,new=load(sys.argv[1]),load(sys.argv[2])
  print('Contracts %s (%s) -> %s (%s)'%(old.get('game'),old.get('unity'),new.get('game'),new.get('unity')))
  print('\n# Adapters')
  failing=[]
  for group in ('adapters','native'):
    for name in sorted(set(old.get(group,{}))|set(new.get(group,{}))):
      a,b=old.get(group,{}).get(name),new.get(group,{}).get(name)
      if b is None:print('%s: not audited in new report'%name);continue
      if not b.get('ok'):failing.append(name)
      status='ok' if b.get('ok') else 'FAILS: '+b.get('error','')
      before='' if a is None else (' (was ok)' if a.get('ok') else ' (was failing)')
      print('%s: %s%s'%(name,status,before))
      for key in ('missing',):
        for item in b.get(key,[]):print('  missing '+item)
      if a is None:continue
      for key,label in (('members','member'),('exports','export')):
        gone=sorted(set(a.get(key,[]))-set(b.get(key,[])));fresh=sorted(set(b.get(key,[]))-set(a.get(key,[])))
        for item in gone:print('  - %s %s'%(label,item))
        for item in fresh:print('  + %s %s'%(label,item))
  print('\n# Classes')
  changed=0
  for name in sorted(set(old.get('classes',{}))|set(new.get('classes',{}))):
    lines=class_changes(name,old.get('classes',{}).get(name),new.get('classes',{}).get(name))
    if lines:changed+=1;print(name);print('\n'.join(lines))
  if not changed:print('No declared-member changes in the classes PGQL resolves.')
  print('\nRESULT: '+('failing contracts: '+', '.join(failing) if failing else 'every audited contract binds'))
  return 1 if failing else 0

if __name__=='__main__':sys.exit(main())
