/* Country palettes and home-strip patterns, referenced 1 October 2026. */
(function(root){
'use strict';
const teams=[
{id:'swe',name:'Sweden',code:'SWE',shirt:'#ffda26',shorts:'#133c85',socks:'#f5d330',trim:'#164994',pattern:'sweden',skin:'#dcb08b',hair:'#c99c5c',brand:'adidas'},
{id:'eng',name:'England',code:'ENG',shirt:'#f5f3ec',shorts:'#172640',socks:'#f5f3ec',trim:'#172640',pattern:'england',skin:'#bb8563',hair:'#2b201c',brand:'nike'},
{id:'nor',name:'Norway',code:'NOR',shirt:'#c8203b',shorts:'#162946',socks:'#162946',trim:'#ece8df',pattern:'norway',skin:'#e0b28d',hair:'#c6a471',brand:'nike'},
{id:'bra',name:'Brazil',code:'BRA',shirt:'#f4dc31',shorts:'#194aa7',socks:'#f8f7e8',trim:'#12623c',pattern:'brazil',skin:'#885637',hair:'#201916',brand:'nike'},
{id:'ita',name:'Italy',code:'ITA',shirt:'#0861c7',shorts:'#f2f3ee',socks:'#1265ca',trim:'#d9b75b',pattern:'italy',skin:'#c59877',hair:'#322520',brand:'adidas'},
{id:'fra',name:'France',code:'FRA',shirt:'#1c55b9',shorts:'#f1f3ee',socks:'#db3547',trim:'#ce9a77',pattern:'france',skin:'#70472e',hair:'#201b1a',brand:'nike'},
{id:'ger',name:'Germany',code:'GER',shirt:'#f1f1e9',shorts:'#1d2329',socks:'#f1f1e9',trim:'#20292d',pattern:'germany',skin:'#d5a382',hair:'#51402c',brand:'adidas'},
{id:'arg',name:'Argentina',code:'ARG',shirt:'#edf5f4',shorts:'#122b40',socks:'#edf5f4',trim:'#132d47',pattern:'argentina',skin:'#c89470',hair:'#32221a',brand:'adidas'},
{id:'esp',name:'Spain',code:'ESP',shirt:'#c92b36',shorts:'#18394e',socks:'#c92b36',trim:'#edca53',pattern:'spain',skin:'#b98159',hair:'#29211d',brand:'adidas'},
{id:'por',name:'Portugal',code:'POR',shirt:'#c1283a',shorts:'#187d67',socks:'#c1283a',trim:'#238775',pattern:'portugal',skin:'#b77f5d',hair:'#29201b',brand:'puma'},
{id:'ned',name:'Netherlands',code:'NED',shirt:'#f47624',shorts:'#f47624',socks:'#f47624',trim:'#192f40',pattern:'netherlands',skin:'#986b4b',hair:'#211b17',brand:'nike'},
{id:'mex',name:'Mexico',code:'MEX',shirt:'#17644c',shorts:'#f5f2e5',socks:'#b7353e',trim:'#ede2c8',pattern:'mexico',skin:'#b98861',hair:'#211d17',brand:'adidas'}
];
function flag(id){const rect=(x,y,w,h,c)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';let s='';
if(id==='swe'||id==='nor'||id==='eng'){s=rect(0,0,60,40,id==='swe'?'#0878bb':id==='nor'?'#c52a3d':'#fff');const c=id==='swe'?'#ffdb35':id==='eng'?'#cf253d':'#fff';s+=rect(0,16,60,8,c)+rect(18,0,8,40,c);if(id==='nor')s+=rect(0,18,60,4,'#173557')+rect(20,0,4,40,'#173557');}
else if(['ita','fra','mex'].includes(id)){const a=id==='ita'?['#168758','#fff','#cf3344']:id==='fra'?['#1746a0','#fff','#e83c48']:['#197e55','#fff','#d72f42'];a.forEach((c,i)=>s+=rect(i*20,0,20,40,c));if(id==='mex')s+='<circle cx="30" cy="21" r="4" fill="#987345"/>';}
else if(id==='ger'||id==='ned'||id==='arg'){const a=id==='ger'?['#181c23','#d3323c','#f4c73c']:id==='ned'?['#ce3041','#fff','#234b9a']:['#75b9e4','#fff','#75b9e4'];a.forEach((c,i)=>s+=rect(0,i*40/3,60,40/3,c));if(id==='arg')s+='<circle cx="30" cy="20" r="4" fill="#edbd42"/>';}
else if(id==='esp'){s=rect(0,0,60,40,'#c62b3b')+rect(0,10,60,20,'#f6cc39')+rect(16,16,5,9,'#ba3543');}
else if(id==='por'){s=rect(0,0,60,40,'#cb3040')+rect(0,0,24,40,'#13825c')+'<circle cx="24" cy="20" r="7" fill="#ebca4a"/><path d="M20 15h8v8l-4 4-4-4z" fill="#f5f2dc"/>';}
else if(id==='bra'){s=rect(0,0,60,40,'#188a52')+'<path d="M30 4L55 20 30 36 5 20z" fill="#f7d945"/><circle cx="30" cy="20" r="10" fill="#1d4d9e"/><path d="M21 17l18 6" stroke="#fff" stroke-width="2"/>';}
return '<svg viewBox="0 0 60 40" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+s+'</svg>';}
root.FSTeams={list:teams,get:id=>teams.find(t=>t.id===id)||teams[0],flag};
if(typeof module!=='undefined')module.exports=root.FSTeams;
})(typeof window!=='undefined'?window:globalThis);
