"""Build articulated footballers and a stitched match ball with Blender.
Run: blender --background --python tools/build_international_assets.py
Original meshes; no network assets or external add-ons required.
"""
import bpy, math, os, json
from mathutils import Vector
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','international'))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def cv(v): return (v[0],-v[2],v[1])
def material(name,col,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough
 return m
mats={k:material(k,c,r) for k,c,r in [
 ('Shirt',(.9,.76,.06),.82),('Sleeves',(.9,.76,.06),.82),('Shorts',(.02,.08,.2),.82),('Socks',(.92,.78,.06),.88),
 ('Skin',(.67,.42,.25),.65),('Hair',(.08,.045,.025),.9),('Boots',(.035,.045,.05),.4),
 ('Trim',(.04,.14,.3),.7),('Eyes',(.91,.89,.8),.45),('Iris',(.025,.028,.032),.6),
 ('Lips',(.36,.17,.13),.8),('Studs',(.6,.65,.66),.38),('Gloves',(.85,.94,.9),.85)]}
def empty(name,pos,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=cv(pos);o.parent=parent;return o
root=empty('Footballer',(0,0,0))
def sphere(name,pos,scale,mat,parent=root,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=(0,0,0))
 o=bpy.context.object;o.name=name;o.parent=parent;o.location=cv(pos);o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(mats[mat])
 for p in o.data.polygons:p.use_smooth=True
 return o
def form(name,rows,mat,parent=root,segments=32):
 # Lofted anatomical cross-sections, evenly laid-out UVs.
 v=[];f=[]
 for y,rx,rz,zc in rows:
  for j in range(segments):
   a=2*math.pi*j/segments+math.pi;v.append(cv((math.sin(a)*rx,y,math.cos(a)*rz+zc)))
 for k in range(len(rows)-1):
  for j in range(segments):
   n=(j+1)%segments;f.append((k*segments+j,k*segments+n,(k+1)*segments+n,(k+1)*segments+j))
 f.append(tuple(reversed(range(segments))));f.append(tuple((len(rows)-1)*segments+j for j in range(segments)))
 if rows[-1][0] < rows[0][0]: f=[tuple(reversed(face)) for face in f]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=parent;mesh.materials.append(mats[mat])
 uv=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:
   idx=mesh.loops[li].vertex_index;j=idx%segments;k=idx//segments
   # Keep the seam at the back.
   u=j/segments
   if poly.index<(len(rows)-1)*segments and poly.index%segments==segments-1 and j==0:u=1
   uv.data[li].uv=(u,k/(len(rows)-1))
 return o
hips=empty('Hips',(0,.93,0),root)
torso=empty('Torso',(0,0,0),hips)
form('ShirtMesh',[(0,.17,.115,0),(.08,.18,.12,0),(.2,.205,.13,0),(.34,.23,.135,0),(.43,.25,.12,0),(.49,.19,.10,0),(.53,.09,.08,0)],'Shirt',torso)
sphere('Collar',(0,.505,0),(.105,.022,.088),'Trim',torso)
sphere('Neck',(0,.55,0),(.074,.085,.072),'Skin',torso)
head=empty('Head',(0,.64,.006),torso)
form('HeadMesh',[(-.045,.065,.061,.01),(0,.098,.081,.015),(.07,.107,.095,0),(.16,.096,.088,-.005),(.205,.062,.061,-.004),(.22,.012,.015,0)],'Skin',head)
sphere('HairCap',(0,.176,-.016),(.103,.065,.09),'Hair',head)
for side in [-1,1]:
 sphere('Ear',(side*.107,.07,0),(.018,.038,.022),'Skin',head)
 sphere('EyeWhite',(side*.045,.091,.085),(.024,.013,.01),'Eyes',head)
 sphere('Pupil',(side*.045,.091,.094),(.009,.010,.005),'Iris',head)
 brow=sphere('Brow',(side*.044,.114,.088),(.030,.008,.009),'Hair',head);brow.rotation_euler[1]=side*.1
sphere('Nose',(0,.067,.099),(.018,.025,.022),'Skin',head)
sphere('Mouth',(0,.020,.082),(.035,.005,.006),'Lips',head)
sphere('Chin',(0,-.015,.061),(.045,.019,.03),'Skin',head)
for side,label in [(-1,'Left'),(1,'Right')]:
 shoulder=empty(label+'Arm',(side*.235,.424,0),torso)
 sleeve=form(label+'Sleeve',[(.02,.078,.088,0),(-.08,.087,.083,0),(-.165,.075,.071,0)],'Sleeves',shoulder,24);sleeve.location.x=side*.035
 upper=form(label+'UpperArm',[(-.13,.064,.069,0),(-.21,.07,.071,0),(-.3,.052,.058,0)],'Skin',shoulder,24);upper.location.x=side*.035
 fore=empty(label+'Forearm',(side*.035,-.29,0),shoulder)
 sphere(label+'Elbow',(0,0,0),(.058,.062,.06),'Skin',fore)
 form(label+'ForearmMesh',[(0,.053,.058,0),(-.07,.057,.063,.009),(-.16,.045,.049,.016),(-.24,.033,.037,.021)],'Skin',fore,24)
 sphere(label+'Hand',(0,-.27,.025),(.052,.07,.026),'Skin',fore)
 sphere(label+'Thumb',(-side*.046,-.246,.027),(.019,.04,.025),'Skin',fore)
 leg=empty(label+'Leg',(side*.105,0,0),hips)
 form(label+'Shorts',[(.015,.105,.12,0),(-.12,.116,.125,.006),(-.23,.095,.10,0)],'Shorts',leg)
 sphere(label+'Thigh',(0,-.255,0),(.085,.205,.087),'Skin',leg)
 knee=empty(label+'Shin',(0,-.43,0),leg)
 sphere(label+'Knee',(0,0,.007),(.072,.074,.072),'Skin',knee)
 form(label+'Sock',[(-.025,.068,.072,0),(-.16,.067,.073,-.008),(-.31,.046,.049,0),(-.38,.044,.045,.012)],'Socks',knee,24)
 foot=empty(label+'Foot',(0,-.385,.01),knee)
 sphere(label+'Boot',(0,-.044,.071),(.073,.055,.145),'Boots',foot)
 sphere(label+'Sole',(0,-.079,.074),(.074,.017,.14),'Studs',foot)
 for dx,dz in [(-.038,-.02),(.038,-.02),(-.042,.13),(.042,.13)]:
  sphere(label+'Stud',(dx,-.098,dz),(.012,.012,.013),'Studs',foot,8,6)
 for k in range(4):sphere(label+'Lace',(0,-.001,.060+k*.015),(.041,.004,.004),'Eyes',foot,8,6)
# Export one compact reusable player. Three.js changes material maps per country.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'footballer.glb'),export_format='GLB',use_selection=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'footballer.blend'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Icosahedron truncated at 1/3 along each edge produces the classic 12/20 panel ball.
phi=(1+math.sqrt(5))/2
verts=[Vector(v).normalized() for v in [(-1,phi,0),(1,phi,0),(-1,-phi,0),(1,-phi,0),(0,-1,phi),(0,1,phi),(0,-1,-phi),(0,1,-phi),(phi,0,-1),(phi,0,1),(-phi,0,-1),(-phi,0,1)]]
faces=[(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),(3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),(4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
white=material('BallIvory',(.88,.9,.84),.48);black=material('BallPanels',(.025,.047,.06),.52);seam=material('BallSeam',(.07,.09,.09),.8)
panels=[]
for a,b,c in faces:panels.append(([verts[a]*2/3+verts[b]/3,verts[b]*2/3+verts[a]/3,verts[b]*2/3+verts[c]/3,verts[c]*2/3+verts[b]/3,verts[c]*2/3+verts[a]/3,verts[a]*2/3+verts[c]/3],white))
for i,v in enumerate(verts):
 neighbours=set()
 for f in faces:
  if i in f:neighbours.update(j for j in f if j!=i)
 n=v.normalized();basis=n.cross(Vector((0,0,1)))
 if basis.length<.01:basis=n.cross(Vector((0,1,0)))
 basis.normalize();other=n.cross(basis)
 pts=[v*2/3+verts[j]/3 for j in neighbours]
 pts.sort(key=lambda p:math.atan2(p.dot(other),p.dot(basis)))
 panels.append((pts,black))
# Project subdivided panels onto a sphere and recess seams.
allv=[];allf=[];mi=[]
for pts,mat in panels:
 center=sum(pts,Vector())/len(pts);pts=[p.lerp(center,.016) for p in pts];start=len(allv)
 allv.append(tuple(center.normalized()*.11))
 for p in pts:allv.append(tuple(p.normalized()*.11))
 for j in range(len(pts)):allf.append((start,start+1+j,start+1+(j+1)%len(pts)));mi.append(0 if mat==white else 1)
mesh=bpy.data.meshes.new('MatchBallMesh');mesh.from_pydata(allv,[],allf);mesh.materials.append(white);mesh.materials.append(black)
o=bpy.data.objects.new('MatchBall',mesh);bpy.context.collection.objects.link(o)
for p,i in zip(mesh.polygons,mi):p.material_index=i;p.use_smooth=True
sub=o.modifiers.new('RoundPanels','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=3
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=sub.name)
for v in o.data.vertices:v.co=v.co.normalized()*.11
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=.1092)
bpy.context.object.name='SeamCore';bpy.context.object.data.materials.append(seam)
for p in bpy.context.object.data.polygons:p.use_smooth=True
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'match-ball.glb'),export_format='GLB')
manifest={'generator':'Blender '+bpy.app.version_string,'player':'footballer.glb','ball':'match-ball.glb','player_source':'footballer.blend','notes':'Original articulated meshes with separate country kit material channels.'}
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('ASSETS_BUILT '+json.dumps(manifest))
