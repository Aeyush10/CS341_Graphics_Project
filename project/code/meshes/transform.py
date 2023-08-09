def rotate():
    with open("bird2.obj", 'w') as fw:
        with open("bird.obj") as fh:
            for line in fh.readlines():
                l = line.strip()
                if not l.startswith('v '):
                    fw.write(f"{l}\n")
                    continue

                l = l.split()
                l = f"{l[0]} {l[1]} {l[3]} {l[2]}\n"
                fw.write(l)

def normalize():
    s = []
    x, y, z = [], [], []
    with open("bird2.obj") as fh:
        for line in fh.readlines():
            l = line.strip()
            if not l.startswith('v '):
                s.append(l)
                continue
            
            l = l.split()
            x.append(float(l[1]))
            y.append(float(l[2]))
            z.append(float(l[3]))
            s.append("v ")

    with open("bird2.obj", 'w') as fw:
        i = 0
        for line in s:
            if not line.startswith('v '):
                fw.write(line + '\n')
                continue
            
            scale = max(z) - min(z)
            fw.write(f"v {x[i] / scale} {y[i] / scale} {(z[i]-min(z))/scale}\n")
            i += 1

def get_trunk_height():
    z = []
    with open("tree2.obj") as fh:
        got_leaves = False
        for line in fh.readlines():
            l = line.strip()
            if l.startswith('g tree leaves'):
                got_leaves = True
                
            if not got_leaves:
                continue
            
            if l.startswith('v '):
                l = l.split()
                z.append(float(l[3]))
            
    print(min(z), max(z))

if __name__ == '__main__':
    rotate()
    normalize()