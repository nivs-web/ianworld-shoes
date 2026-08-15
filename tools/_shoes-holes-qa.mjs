import sharp from 'sharp';
const files = ['public/assets/shoes/shoes_master.png','public/assets/shoes/shoes_game.png'];
const cells = { 'shoes_master.png': [52,32], 'shoes_game.png': [42,26] };
for (const f of files) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const [cw,ch] = cells[f.split('/').pop()];
  let bad = 0, worst = [];
  for (let idx=0; idx<130; idx++){
    const ox=(idx%10)*cw, oy=((idx/10)|0)*ch;
    const n=cw*ch, out=new Uint8Array(n), st=[];
    const A=(x,y)=>data[((oy+y)*info.width+ox+x)*4+3];
    const push=(x,y)=>{const i=y*cw+x; if(!out[i]&&A(x,y)===0){out[i]=1;st.push([x,y]);}};
    for(let x=0;x<cw;x++){push(x,0);push(x,ch-1);}
    for(let y=0;y<ch;y++){push(0,y);push(cw-1,y);}
    while(st.length){const [x,y]=st.pop();
      if(x>0)push(x-1,y); if(x<cw-1)push(x+1,y); if(y>0)push(x,y-1); if(y<ch-1)push(x,y+1);}
    let holes=0;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) if(A(x,y)===0 && !out[y*cw+x]) holes++;
    if(holes){bad++; worst.push([idx,holes]);}
  }
  console.log(f, '구멍 있는 신발:', bad, worst.slice(0,10).map(a=>a.join(':')).join(' '));
}
