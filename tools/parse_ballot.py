"""Parse a TMF Proxy Ballot PDF text (pdftotext -layout, spaces squeezed) into fund facts."""
import re,sys,json
ALL=["MSTR","META","NVDA","COIN","QQQ","RDDT","TSLA","GOOGL","USDG","GLD","SGOV","CASHCAT","VIRTUAL","PONS","AI","MANCER","STONKBROKER","APE","DERP"]
def parse(txt):
    L=[l.strip() for l in txt.splitlines() if l.strip()]
    out={"tokens":{}}
    m=re.search(r'What (\w+) holds',txt); out["fund"]=m.group(1)
    m=re.search(r'^(\d+/\d+/\d+), (\d+:\d+ [AP]M)',txt,re.M); out["captured"]=m.group(1)+" "+m.group(2)
    out["tmf_held"]=float(re.search(r'\$TMF H E L D ([\d.]+)%',txt).group(1))
    out["chairs"]=int(re.search(r'chairs this week (\d+) of (\d+)',txt).group(1))
    out["closes"]=re.search(r'Fri, \w+ \d+ · [\d:]+ [AP]M ET',txt).group(0) if re.search(r'Fri, \w+ \d+ · [\d:]+ [AP]M ET',txt) else None
    m=re.search(r'Headed to WETH so far: (.*?)\. Each has',txt.replace('\n',' '),re.S)
    out["headed"]=[t.strip() for t in re.sub(r'\s+',' ',m.group(1)).split(',')] if m else []
    # card summary line: "$TMF 37% held WETH 49.6% NVDA 7.87% GLD 5.53%" (after "your card")
    summ=[l for l in L if l.startswith('$TMF ') and ' held WETH ' in l]
    s=summ[-1]; out["room_split"]={k:float(v) for k,v in re.findall(r'([A-Z]+) ([\d.]+)%',s.replace('$TMF ','TMF '))}
    cur=None
    for l in L:
        m=re.match(r'^([A-Z]+) About',l)
        if m and m.group(1) in ALL: cur=m.group(1); out["tokens"][cur]={"shown":True}; continue
        if not cur: continue
        t=out["tokens"][cur]
        m=re.search(r'the room: ([\d.]+)%( \(vetoed so far\))?',l)
        if m: t["room_pct"]=float(m.group(1)); t["vetoed"]=bool(m.group(2))
        m=re.search(r'(1(?:,000,000)?) '+cur+r' = ([\d.,]+) WETH',l)
        if m: t["onchain"]=m.group(2)+(" WETH per 1M" if m.group(1)!="1" else " WETH")
    # fills: join lines and find per token block
    blocks=re.split(r'\n\s*(?=(?:'+'|'.join(ALL)+r') About)',txt)
    for b in blocks:
        m=re.match(r'\s*([A-Z]+) About',b)
        if not m or m.group(1) not in out["tokens"]: continue
        f=re.search(r'take about\s+(\d+)\s+Fridays',re.sub(r'\s+',' ',b))
        if f: out["tokens"][m.group(1)]["fill"]=int(f.group(1))
    # status for every token from ballot text
    backed={k:v for k,v in out["room_split"].items() if k not in("TMF","WETH")}
    for tk in ALL:
        t=out["tokens"].setdefault(tk,{"shown":False})
        if tk in backed: t["status"]="backed"; t["room_pct"]=backed[tk]
        elif tk in out["headed"]: t["status"]="vetoed"; t["room_pct"]=0.0
        else: t["status"]="no_cards"; t["room_pct"]=0.0
    return out
if __name__=="__main__":
    print(json.dumps(parse(open(sys.argv[1]).read()),indent=1))
