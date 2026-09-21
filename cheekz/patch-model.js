import * as THREE from './vendor/three.module.js';
export const layerSpecs=[{scale:1,thick:.14,base:.35},{scale:1.07,thick:.25,base:.081},{scale:1.34,thick:.045,base:.02}];
export function bendAt(x,z){return .05*x*x+.016*z*z+.006*Math.sin(x*1.7+z);}
// Rounded rectangle: longer X axis, soft shoulders, subtly bowed faces.
export function patchGeometry(scale,thickness,seal=false){
 const segments=256,rings=48,pos=[],uv=[],indices=[],profiles=[];
 for(let r=0;r<=rings;r++){const t=r/rings;profiles.push([t,thickness+.012*(1-t*t)])}
 // Closely sampled edge roll gives highlights a continuous rounded profile.
 for(let j=1;j<=12;j++){const t=j/12;profiles.push([1+.012*Math.sin(t*Math.PI),thickness*(1-t)])}
 for(let r=rings-1;r>=0;r--)profiles.push([r/rings,0]);
 profiles.forEach(([radius,height],row)=>{for(let j=0;j<=segments;j++){
 const theta=j/segments*Math.PI*2,c=Math.cos(theta),n=Math.sin(theta);
 const x=1.50*scale*radius*Math.sign(c)*Math.pow(Math.abs(c),.72);
 const z=1.03*scale*radius*Math.sign(n)*Math.pow(Math.abs(n),.72);
 const lip=seal?.09*THREE.MathUtils.smoothstep(radius,.78,1):0;
 pos.push(x,height+bendAt(x,z)+lip,z);uv.push(x/(3.05*scale)+.5,z/(2.10*scale)+.5);
 if(row>0&&j>0){const a=row*(segments+1)+j,b=a-1,d=a-segments-1,c=d-1;indices.push(a,b,d,b,c,d)}
 }});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
