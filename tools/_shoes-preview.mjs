import sharp from 'sharp';
// 마스터 아틀라스 앞 40개를 6배 확대해 체크무늬 위에 얹어 투명 구멍을 눈으로 본다
const S=6, COLS=10, ROWS=4, CW=52, CH=32;
const { data, info } = await sharp('public/assets/shoes/shoes_master.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=COLS*CW*S, H=ROWS*CH*S;
const out=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
  const c=(((x>>3)+(y>>3))&1)?255:200; out[i]=c;out[i+1]=40;out[i+2]=c;out[i+3]=255;}
for(let y=0;y<ROWS*CH;y++)for(let x=0;x<COLS*CW;x++){
  const si=(y*info.width+x)*4; if(data[si+3]===0) continue;
  for(let dy=0;dy<S;dy++)for(let dx=0;dx<S;dx++){
    const di=(((y*S+dy)*W)+(x*S+dx))*4;
    out[di]=data[si];out[di+1]=data[si+1];out[di+2]=data[si+2];out[di+3]=255;}}
await sharp(out,{raw:{width:W,height:H,channels:4}}).png().toFile('/tmp/shoes_qa.png');
console.log('ok',W,H);
