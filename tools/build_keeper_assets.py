"""Create a continuous, skinned goalkeeper with an anatomical armature.
All geometry is original. Units are metres; source coordinates are x/right,y/up,z/pitch.
"""
import bpy, math, os, json, hashlib
from mathutils import Matrix
OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','international'))
os.makedirs(OUT,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def cv(v):return (v[0],-v[2],v[1])
def mat(name,color,rough=.8):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 return m
M={name:mat(name,color,r) for name,color,r in [
 ('KeeperJersey',(.025,.28,.24),.86),('KeeperTrim',(.50,.79,.22),.75),('KeeperShorts',(.016,.029,.034),.86),
 ('KeeperSocks',(.02,.22,.20),.88),('KeeperSkin',(.30,.16,.095),.68),('KeeperHair',(.023,.014,.009),.94),
 ('KeeperBoots',(.015,.024,.028),.45),('KeeperSole',(.27,.32,.30),.65),('KeeperGloves',(.81,.85,.73),.78),
 ('KeeperGrip',(.025,.05,.04),.9),('KeeperEyes',(.66,.65,.56),.55),('KeeperIris',(.013,.019,.014),.6),
 ('KeeperLips',(.15,.055,.037),.8)]}
objects=[]
def tag(o,part,side=0):o['part']=part;o['side']=side;objects.append(o);return o
def ellipsoid(name,pos,scale,material,part,side=0,segments=24,rings=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=cv(pos))
 o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(M[material])
 for p in o.data.polygons:p.use_smooth=True
 return tag(o,part,side)
def form(name,rows,material,part,side=0,x=0,segments=36,subdivide=True):
 vs=[];fs=[]
 for y,rx,rz,z in rows:
  for j in range(segments):
   a=math.tau*j/segments;vs.append(cv((x+math.sin(a)*rx,y,z+math.cos(a)*rz)))
 for k in range(len(rows)-1):
  for j in range(segments):
   n=(j+1)%segments;fs.append((k*segments+j,k*segments+n,(k+1)*segments+n,(k+1)*segments+j))
 fs.append(tuple(reversed(range(segments))));fs.append(tuple((len(rows)-1)*segments+j for j in range(segments)))
 if rows[-1][0]<rows[0][0]:fs=[tuple(reversed(face)) for face in fs]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(M[material])
 for p in mesh.polygons:p.use_smooth=True
 if subdivide:
  bpy.context.view_layer.objects.active=o;o.select_set(True);mod=o.modifiers.new('TailoredSurface','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
 return tag(o,part,side)
form('KeeperTorso',[(.98,.17,.112,0),(1.03,.177,.118,0),(1.13,.185,.123,0),(1.26,.216,.133,0),(1.37,.244,.136,0),(1.435,.259,.117,0),(1.49,.205,.095,0),(1.53,.085,.066,0)],'KeeperJersey','torso')
ellipsoid('KeeperCollar',(0,1.528,.002),(.084,.021,.067),'KeeperTrim','torso')
ellipsoid('KeeperNeck',(0,1.575,.005),(.068,.077,.066),'KeeperSkin','head')
form('KeeperHead',[(1.615,.054,.055,.024),(1.644,.083,.071,.018),(1.69,.092,.083,.010),(1.755,.091,.082,-.005),(1.813,.070,.065,-.005),(1.844,.016,.020,-.007)],'KeeperSkin','head')
ellipsoid('KeeperHair',(0,1.805,-.018),(.088,.042,.075),'KeeperHair','head')
for side in [-1,1]:
 ellipsoid('KeeperEar',(side*.094,1.714,-.006),(.015,.030,.018),'KeeperSkin','head')
 ellipsoid('KeeperEye',(side*.037,1.736,.081),(.018,.008,.006),'KeeperEyes','head')
 ellipsoid('KeeperIris',(side*.037,1.736,.086),(.006,.0065,.003),'KeeperIris','head')
 ellipsoid('KeeperBrow',(side*.037,1.752,.081),(.025,.0045,.007),'KeeperHair','head')
ellipsoid('KeeperNose',(0,1.712,.087),(.014,.024,.022),'KeeperSkin','head')
ellipsoid('KeeperMouth',(0,1.665,.080),(.025,.004,.004),'KeeperLips','head')
form('KeeperWaist',[(.90,.197,.12,0),(.96,.20,.125,0),(1.005,.181,.119,0)],'KeeperShorts','hips')
for side,label in [(-1,'Left'),(1,'Right')]:
 # A single surface crosses the elbow; skin weights bend it without cracks.
 arm=form(label+'Sleeve',[(1.46,.065,.080,0),(1.415,.083,.087,0),(1.33,.081,.081,0),(1.235,.068,.073,0),(1.155,.059,.063,0),(1.118,.056,.061,.006),(1.08,.057,.062,.008),(1.00,.060,.065,.015),(.92,.048,.050,.025),(.85,.037,.038,.034),(.834,.036,.036,.035)],'KeeperJersey','arm',side,x=side*.282)
 ellipsoid(label+'Cuff',(side*.29,.843,.035),(.040,.018,.040),'KeeperTrim','arm',side)
 form(label+'ShortLeg',[(.99,.104,.117,0),(.90,.116,.12,0),(.79,.111,.11,0),(.75,.101,.097,0)],'KeeperShorts','leg',side,x=side*.115)
 leg=form(label+'LegSurface',[(.80,.094,.09,0),(.71,.094,.093,0),(.62,.084,.083,.002),(.55,.066,.068,.008),(.52,.064,.065,.012),(.48,.063,.066,.010),(.40,.076,.075,0),(.32,.067,.067,-.008),(.21,.048,.048,-.005),(.12,.039,.039,0),(.105,.039,.04,0)],'KeeperSkin','leg',side,x=side*.115)
 leg.data.materials.append(M['KeeperSocks'])
 for polygon in leg.data.polygons:
  if sum(leg.data.vertices[i].co.z for i in polygon.vertices)/len(polygon.vertices)<.455:polygon.material_index=1
 ellipsoid(label+'Boot',(side*.115,.064,.075),(.070,.052,.145),'KeeperBoots','foot',side)
 ellipsoid(label+'Sole',(side*.115,.025,.078),(.072,.014,.142),'KeeperSole','foot',side)
 for dx,dz in [(-.038,-.018),(.038,-.018),(-.040,.13),(.040,.13)]:
  ellipsoid(label+'Stud',(side*.115+dx,.010,dz),(.011,.010,.012),'KeeperGrip','foot',side,10,6)
 for row in range(4):ellipsoid(label+'Lace',(side*.115,.111,.05+row*.017),(.039,.003,.003),'KeeperGloves','foot',side,12,8)
 # Palm, separately modelled fingers, thumb and wrist strap give a readable saving hand.
 ellipsoid(label+'GlovePalm',(side*.29,.788,.043),(.043,.058,.025),'KeeperGloves','hand',side)
 ellipsoid(label+'GloveStrap',(side*.29,.827,.038),(.042,.013,.030),'KeeperGrip','hand',side)
 for i in range(4):
  dx=(i-1.5)*.020;length=[.031,.043,.046,.037][i]
  ellipsoid(label+'Finger'+str(i),(side*.29+dx,.731-length*.25,.045),(.010,length,.014),'KeeperGloves','hand',side,12,8)
 ellipsoid(label+'Thumb',(side*.29-side*.049,.780,.048),(.019,.035,.018),'KeeperGloves','hand',side,16,10)
 ellipsoid(label+'GloveBack',(side*.29,.794,.019),(.032,.034,.007),'KeeperTrim','hand',side)
# Small jersey number, converted to geometry so no fonts or textures are fetched at runtime.
bpy.ops.object.text_add(location=cv((0,1.285,.139)),rotation=(math.pi/2,0,0))
number=bpy.context.object;number.name='KeeperNumber';number.data.body='1';number.data.align_x='CENTER';number.data.size=.085;number.data.extrude=.0005
number.data.materials.append(M['KeeperTrim']);bpy.ops.object.convert(target='MESH');tag(bpy.context.object,'torso')
# Bake all object transforms before binding.
for o in objects:
 o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
bones=[
 ('Root',(0,0,0),(0,.10,0),None),
 ('Hips',(0,.99,0),(0,1.45,0),'Root'),('Spine',(0,.99,0),(0,1.45,0),'Hips'),('Head',(0,1.61,.01),(0,1.83,.01),'Spine')]
for side,label in [(-1,'Left'),(1,'Right')]:
 bones += [(label+'UpperArm',(side*.255,1.435,0),(side*.29,1.118,0),'Spine'),
 (label+'Forearm',(side*.29,1.118,0),(side*.29,.828,.035),label+'UpperArm'),
 (label+'Hand',(side*.29,.828,.035),(side*.29,.73,.035),label+'Forearm'),
 (label+'Thigh',(side*.115,.99,0),(side*.115,.52,.015),'Hips'),
 (label+'Shin',(side*.115,.52,.015),(side*.115,.10,0),label+'Thigh'),
 (label+'Foot',(side*.115,.10,0),(side*.115,.055,.19),label+'Shin')]
arm_data=bpy.data.armatures.new('KeeperAnatomy');rig=bpy.data.objects.new('KeeperRig',arm_data);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in bones:
 b=arm_data.edit_bones.new(name);b.head=cv(head);b.tail=cv(tail)
 if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def blend(y,centre,width):return max(0,min(1,(y-centre)/width+.5))
for o in objects:
 part=o['part'];side=int(o['side']);label='Left' if side<0 else 'Right'
 for name,_,_,_ in bones:o.vertex_groups.new(name=name)
 for v in o.data.vertices:
  y=v.co.z
  if part=='head':weights={'Head':1}
  elif part=='hips':weights={'Hips':1}
  elif part=='torso':
   u=blend(y,1.065,.15);weights={'Hips':1-u,'Spine':u}
  elif part=='arm':
   u=blend(y,1.118,.16);weights={label+'UpperArm':u,label+'Forearm':1-u}
  elif part=='hand':weights={label+'Hand':1}
  elif part=='foot':weights={label+'Foot':1}
  else:
   u=blend(y,.52,.15);weights={label+'Thigh':u,label+'Shin':1-u}
   if y>.94:weights={label+'Thigh':.6,'Hips':.4}
  for name,weight in weights.items():
   if weight>0:o.vertex_groups[name].add([v.index],weight,'REPLACE')
 mod=o.modifiers.new('KeeperSkin','ARMATURE');mod.object=rig;o.parent=rig
 for prop in ['part','side']:del o[prop]
# Join surfaces into one skinned object. glTF groups primitives by material,
# reducing draw calls while preserving the common anatomical vertex groups.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
bpy.context.object.name='KeeperBody'
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'keeper.glb'),export_format='GLB',use_selection=True,export_apply=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'keeper.blend'))
manifest_path=os.path.join(OUT,'manifest.json')
manifest=json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
source_dir=os.path.dirname(__file__)
source_sha=hashlib.sha256(b''.join(open(os.path.join(source_dir,p),'rb').read() for p in ['build_international_assets.py','build_keeper_assets.py'])).hexdigest()
manifest.update({'asset_source_sha':source_sha,'keeper':'keeper.glb','keeper_source':'keeper.blend','keeper_rig':'16-bone anatomical armature with continuous elbow/knee skinning','generator':'Blender '+bpy.app.version_string})
with open(manifest_path,'w') as h:json.dump(manifest,h,indent=2)
print('KEEPER_BUILT '+str(len(objects))+' skinned mesh parts')
