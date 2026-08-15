import sharp from 'sharp';
const Z=6;
const g=await sharp('public/assets/ui/gauge_frame.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const p=await sharp('public/assets/ui/btn_pause.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=(g.info.width+p.info.width+6)*Z, H=Math.max(g.info.height,p.info.height)*Z+12;
const buf=Buffer.alloc(W*H*4);
for(let i=0;i<buf.length;i+=4){buf[i]=40;buf[i+1]=32;buf[i+2]=38;buf[i+3]=255;}
const blit=(o,ox)=>{for(let y=0;y<o.info.height;y++)for(let x=0;x<o.info.width;x++){
 const si=(y*o.info.width+x)*4; if(o.data[si+3]===0)continue;
 for(let dy=0;dy<Z;dy++)for(let dx=0;dx<Z;dx++){const di=(((y*Z+dy+6)*W)+(x+ox)*Z+dx)*4;
  buf[di]=o.data[si];buf[di+1]=o.data[si+1];buf[di+2]=o.data[si+2];buf[di+3]=255;}}};
blit(g,0); blit(p,g.info.width+6);
// 게이지 채움 시뮬 (60%)
const FILL=[0xcd,0x44,0x21];
for(let y=4;y<14;y++)for(let x=4;x<4+Math.round(138*0.6);x++)
 for(let dy=0;dy<Z;dy++)for(let dx=0;dx<Z;dx++){const di=(((y*Z+dy+6)*W)+x*Z+dx)*4;
  buf[di]=FILL[0];buf[di+1]=FILL[1];buf[di+2]=FILL[2];buf[di+3]=255;}
await sharp(buf,{raw:{width:W,height:H,channels:4}}).png().toFile('/tmp/ui_preview.png');
console.log('ok',W,H);
