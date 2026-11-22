from pathlib import Path
import sys
root=Path(sys.argv[1])
for p in (root/'Docker/scripts').glob('*.sh'):
 s=p.read_text(encoding='utf-8').replace('\r\n','\n')
 s='\n'.join(line for line in s.split('\n') if 'echo "Database URL:' not in line)
 p.write_text(s,encoding='utf-8',newline='\n')
