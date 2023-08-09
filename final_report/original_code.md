### All original code written will appear in this file
<br>

**Setting up globalTime variable**

In `main_terrain.js`:
```js
//Setting time for the purposes of animation
let globalTime = 0.

regl.frame((frame) => {
	//increment the globalTime variable using the frame time
	globalTime = frame.time * 0.001; // Convert frame time to seconds
    ...
})    
```

In `terrain.js`:
```js
uniforms: {
    ...
    globalTime: globalTime,
    ...
}

pipeline_draw_terrain({
    ...
    globalTime: this.globalTime,
    ...
})
```
**Animated waves**

In `main_terrain.js`:

```js
//Function modified to pass in globalTime
let terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer(), globalTime) 

function terrain_actor_update() {
    terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer(), globalTime)
    update_needed = true
}
//Call terrain_actor_update every 33.3 ms (about 30 FPS)
window.setInterval(terrain_actor_update, 1000.0/30.0) 

//Every call to init_terrain must now pass in globalTime
terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer(), globalTime)
```

In `terrain.js`:

```js
export function init_terrain(regl, resources, height_map_buffer, globalTime) {
	//This function now takes globalTime as a parameter
	const terrain_mesh = terrain_build_mesh(new BufferData(regl, height_map_buffer), globalTime)
    ...
}
```

In `terrain.vert.glsl`:

Note that code for 3D Perlin noise is not included because it was unchanged from the online source. 

```c
if (position.z < terrain_water_level) {
    //Change the position of the vertex position using sinusoid and noise function to create animated wave
    gl_Position = mat_mvp * vec4(position.xy, position.z + 0.1*sin(10.0*position.z + 10.0*position.x + 10.0*position.y)*noise_3D(vec3(300.0*globalTime, 10.0*(position.x-25.0*globalTime), 10.0*(position.y-25.0*globalTime))), 1);
}
else
    //Not a water pixel 
    gl_Position = mat_mvp * vec4(position, 1);
```

**Bezier Curve**

In `main_terrain.js`:
```js
let cam_y = 0
let cam_z = 0.3

//point locations
const pl = [[-0.5,0.5,0.3], //top left
[0,0.5,0.0],
[0.5,0.5,0.3],
[-0.5,0,0.0],
[0, 0, 0.3], //center
[0.5,0,0.0],
[-0.5,-0.5,0.3],
[0,-0.5,0.0],
[0.5,-0.5,0.3], //bottom right
[-0.5,0.5,0.0]] //for wrapping

const curve0 = [
	pl[7],pl[6],pl[3], pl[0],pl[1], //1,2,3,4,5 - curve 1
	pl[2],pl[5], pl[8], pl[7], //6,7,8,9 -- curve 2
	pl[6],pl[3], pl[0],pl[1], //2,3,4,5 - curve 1 for wrapping

]

const curve1 = [
	pl[6],pl[3],pl[0], pl[1],pl[4], //1,2,3,4,5 - curve 1
	pl[7],pl[8],pl[5], pl[2], //6,7,8,9 -- curve 2
	pl[1],pl[0],pl[3], pl[4], //10,11,12,13 -- curve 3
	pl[5],pl[8],pl[7], pl[6], //14,15,16,17 --curve 4 (17 same as 1)
	pl[3],pl[0], pl[1],pl[4] //2,3,4,5 - curve 1 for wrapping
]

const curve2 = [
	pl[0],pl[3],pl[6], pl[7],pl[4], //1,2,3,4,5 - curve 1
	pl[1],pl[2],pl[5], pl[8], //6,7,8,9 -- curve 2
	pl[7],pl[6],pl[3], pl[4], //10,11,12,13 -- curve 3
	pl[5],pl[2],pl[1], pl[0], //14,15,16,17 --curve 4 (17 same as 1)
	pl[3],pl[6], pl[7],pl[4] //2,3,4,5 - curve 1 for wrapping
]

function comb(n,i)
{
	let num = 1.0
	let den = 1.0
	if (i < n - i)
		i = n - i //making i as big as possible 
	for (let k = i + 1; k <= n; k++) {
		num = num*k;
	} //n!/i!
	for (let k = 1; k <= n - i; k++) {
		den = den*k;
	} //(n - i)!
	return (num/den)
}

function bezierpoint(curve,offset,n,t)
{
	let point = [0.0,0.0,0.0]
	//console.log(curve0[0])
	for (let i = 0; i <= n; i++) {
		point[0] += comb(n,i) * (t ** i) * ((1 - t) ** (n - i)) * curve[offset + i][0];
		point[1] += comb(n,i) * (t ** i) * ((1 - t) ** (n - i)) * curve[offset + i][1];
		point[2] += comb(n,i) * (t ** i) * ((1 - t) ** (n - i)) * curve[offset + i][2];
		}
	return point
}

function camera_curve(curveno) {
	const mytime = 90*globalTime
	MouseCoordinates.mouse_offset_X -= 2./GRID_HEIGHT
	MouseCoordinates.mouse_offset_Y -= 2./GRID_HEIGHT
	texture_fbm.draw_texture_to_buffer({width: GRID_WIDTH, height: GRID_HEIGHT, mouse_offset: [MouseCoordinates.mouse_offset_X, MouseCoordinates.mouse_offset_Y]})
	terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer(), globalTime)
	update_needed = true
	let campos = [0.0,0.0,0.0]
	let camtarget = [0.0,0.0]
	let curve = null
	const  frac_time = mytime - parseInt(mytime) //use this as t for bezier curve, goes from 0 to 1 for one set of points
	let no_of_sets = 0

	//choosing curve
	if (curveno == 0)
	{
		curve = curve0
		no_of_sets = 2
	}
	else if (curveno == 1)
	{
		curve = curve1
		no_of_sets = 4
	}
	else if (curveno == 2)
	{
		curve = curve2
		no_of_sets = 4
	}
	
	let point_offset = parseInt(mytime) % no_of_sets //creating sets of points
	
	//bezier curve: curves of 5 points each
	campos = bezierpoint(curve,4*point_offset, 4, frac_time) //bezier curve for camera position
	
	//setting target of camera to a point just ahead on the curve
	if (frac_time < 0.8)
	{
		camtarget = bezierpoint(curve,4*point_offset, 4, frac_time + 0.2)
	}
	else
	{
		camtarget = bezierpoint(curve,4*(point_offset + 1), 4, frac_time - 0.8)
	}
	
	//updating variables
	cam_y = campos[1]
	cam_z = campos[2]
	cam_distance_factor = -campos[0]/cam_distance_base

	CamVariables.cam_target = [camtarget[0]/2, camtarget[1]/2, camtarget[2]*0.75] //scaling target for better viewing

	//calling camera transform function
	update_cam_transform(0)
}

let curveID = null

window.addEventListener('keydown', (event) => {
	const step_size = 2./GRID_HEIGHT
	if(event.key == 'ArrowRight') MouseCoordinates.mouse_offset_X -= step_size
	else if(event.key == 'ArrowLeft') MouseCoordinates.mouse_offset_X += step_size
	else if(event.key == 'ArrowUp') MouseCoordinates.mouse_offset_Y -= step_size
	else if(event.key == 'ArrowDown') MouseCoordinates.mouse_offset_Y += step_size
	else if(event.key == 'x') 
	{
		clearInterval(curveID);
		curveID = null;
		cam_y = 0
		cam_z = 0.3
		CamVariables.cam_target = [0,0,0.2]
		cam_distance_factor = 1.
		cam_angle_z = -0.5 // in radians!
		cam_angle_y = -0.42 // in radians!
		update_cam_transform(0)
	}
	else if(event.key == '1') 
	{
		cam_y = 0
		cam_z = 0.3
		CamVariables.cam_target = [0,0,0.2]
		cam_distance_factor = 1.
		cam_angle_z = -0.5 // in radians!
		cam_angle_y = -0.42 // in radians!
		update_cam_transform(0)
		if (curveID == null) curveID = window.setInterval(camera_curve,1000/50,0)
	}
	else if(event.key == '2') 
	{
		cam_y = 0
		cam_z = 0.3
		CamVariables.cam_target = [0,0,0.2]
		cam_distance_factor = 1.
		cam_angle_z = -0.5 // in radians!
		cam_angle_y = -0.42 // in radians!
		update_cam_transform(0)
		if (curveID == null) curveID = window.setInterval(camera_curve,1000/50,1)
	}
	else if(event.key == '3') 
	{
		cam_y = 0
		cam_z = 0.3
		CamVariables.cam_target = [0,0,0.2]
		cam_distance_factor = 1.
		cam_angle_z = -0.5 // in radians
		cam_angle_y = -0.42 // in radians!
		update_cam_transform(0)
		if (curveID == null) curveID = window.setInterval(camera_curve,1000/50,2)
	}
	texture_fbm.draw_texture_to_buffer({width: GRID_WIDTH, height: GRID_HEIGHT, mouse_offset: [MouseCoordinates.mouse_offset_X, MouseCoordinates.mouse_offset_Y]})
	//Every call to init_terrain must now pass in globalTime
	terrain_actor = init_terrain(regl, resources, texture_fbm.get_buffer(), globalTime)
	update_needed = true
})
```

**Cubemap**

In `main_terrain.js`:
```js
const posX = await load_image('cubemap_imgs/sky_posX.png')
const negX = await load_image('cubemap_imgs/sky_negX.png')
const posY = await load_image('cubemap_imgs/sky_posY.png')
const negY = await load_image('cubemap_imgs/sky_negY.png')
const posZ = await load_image('cubemap_imgs/sky_posZ.png')
const negZ = await load_image('cubemap_imgs/sky_negZ.png')
const cubeimages = [posX,negX,posY,negY,posZ,negZ]

const cube = regl.cube(...cubeimages)
//regl.TextureCube()
// var cubefbo = regl.framebufferCube({
// 		radius: 1,
// 		color: cube,
// 		depth: false,
// 		stencil: false
// 	  })
//  console.log('cube: ', cube.width, cube.height, cube.format, cube.type, cube.mag, cube.min, cube.wrapS, cube.wrapT)
	
resources['cubemap'] = cube
```

In `terrain.js`:
```js
water_cubemap: regl.prop('cubemap'),
camera_direction: CamVariables.cam_target,
cubemap: resources['cubemap']
```

In `terrain.vert.glsl`:
```glsl
uniform vec3 camera_direction;
view_vector = normalize(camera_direction - vertex_position_eye);
if (position.z < terrain_water_level) {
	//Change the position of the vertex position using sinusoid and noise function to create animated wave
	float water_height = position.z/7.0 + 0.02*sin(10.0*position.z + 10.0*position.x + 10.0*position.y + 1000.0*globalTime);
	gl_Position = mat_mvp * vec4(position.xy, water_height ,1);
	temp_norm = vec3(normal.x/7.0 + 0.2*cos(10.0*position.z + 10.0*position.x + 10.0*position.y + 1000.0*globalTime)*(normal.x + 1.0) , normal.y/7.0 + 0.2*cos(10.0*position.z + 10.0*position.x + 10.0*position.y+ 1000.0*globalTime)*(normal.y + 1.0) , 1.0/7.0 + 0.2*cos(10.0*position.z + 10.0*position.x + 10.0*position.y+ 1000.0*globalTime) );
	surface_normal = normalize(mat_normals*(temp_norm));
}
```

In `terrain.frag.glsl`:

```glsl
uniform sampler2D water_tex;
uniform samplerCube water_cubemap;

vec3 dir_to_camera_new = normalize(view_vector);
vec3 refl_direction = normalize(2.*dot(surf_norm_new,dir_to_camera_new)*surf_norm_new - dir_to_camera_new);

if(height < terrain_water_level){
	gl_FragColor = textureCube(water_cubemap,refl_direction);
	vec3 refl_direction = normalize(2.*dot(surf_norm_new,dir_to_camera_new)*surf_norm_new - dir_to_camera_new);
}
```

**Set the terrain shape in the vertex shader**

Note: the code for this was already present in the original PG1 exercise code, I just had to understand it and call it the right way from the file `terrain.vert.glsl`

```glsl
...
vec2 local_coord =  2. * position.xy * viewer_scale;
vec2 v2f_tex_coords = viewer_position + local_coord;
vec3 noise_value = tex_fbm_for_terrain(v2f_tex_coords);

// noise value lies in the range (0,1) so we subtract 0.5 to get it in the range (-0.5,0.5)
v2f_height = noise_value.x - 0.5;
vec3 position_new = vec3(position.x, position.y, v2f_height);
...

if (position_new.z < terrain_water_level) {
		...
		gl_Position = mat_mvp * vec4(position.xy, water_height ,1);
		...
}
else
	//Not a water pixel 
    gl_Position = mat_mvp * vec4(position_new, 1);
...
```

**Calculate the normals in the shader**

In `terrain.vert.glsl`. The `noise_value.yz` contains the derivative of the height of the terrain. The derivative has been calculated analaytically from the expression of perlin noise (and the expression of this derivative was taken from an online resource).
```glsl
...
// the yz components of noise_value contain the derivatives of the noise function
vec3 normal = normalize(vec3(-noise_value.yz, 1));
...
```

**Instance rendering of simple meshes for birds / fish / trees**

In `instanced_meshes/utils.js`
```js
// function to get the offsets and scales for the various instanced objects (trees/birds)
export function get_positions(thresh, terrain_mesh, scale_base=1/20, birds=false){
    let translations = []
    let scales = []
    let models = []
    for(let i = 0; i < terrain_mesh.vertex_positions.length; i++){
        let terrain_point = terrain_mesh.vertex_positions[i];
        let x = terrain_point[0] -   MouseCoordinates.mouse_offset_X/2
        let y = terrain_point[1] -   MouseCoordinates.mouse_offset_Y/2

        x = Math.round((x + MIN_TERRAIN_VAL) * GRID_HEIGHT)
        y = Math.round((y + MIN_TERRAIN_VAL) * GRID_WIDTH)

        var hash = CryptoJS.SHA256(x.toString() + y.toString());

        // hash is a hex string, need to convert it to an integer
        // we use .slice(6) to take only 6 characters of the hash for a faster
        // conversion to int
        // modulo 2047 is done to bring the number to a reasonable range
        var hash_num = parseInt(hash.toString(CryptoJS.enc.Hex).slice(6), 16) % 2047;
        
        // threshold the hash_num to determine the placing of objects
        if(hash_num > thresh){

            // for birds, the placing is also dependent on the x and y coordinates of the point
            if(!birds || ((Math.abs(terrain_point[0]) + Math.abs(terrain_point[1])) < 0.3)){

                // this function is chosen because it gives a good distinction 
                // between the sizes of the objects
                let scale = Math.exp(1 / (hash_num - thresh)) * scale_base

                // translations are scaled down by the scale factor to make it comparable to the mesh
                // coordinates
                translations.push([terrain_point[0] / scale, terrain_point[1] / scale , 0.4 / scale]);
                scales.push(scale);

                // create the model to world matrix
                let mat_model_to_world = mat4.create()
                mat4.fromRotationTranslationScale(mat_model_to_world, fromEuler(quat.create(), 0, 0, 0), [0, 0, 0], [scale, scale, scale])
                models.push(mat_model_to_world)
            }
        }
    }
    
    return {translations, scales, models}    
}

// function to make a call to the draw funciton for the instanced objects
// this function performs the processing of the parameters before calling
// such as breaking the matrix models into separate rows
export function draw_pipeline(pipeline_draw_function, light_position_cam, mat_view, mat_projection, translations, scales, models){

    // call the relevant draw function for the instanced objects
    pipeline_draw_function({
        offset: {
            buffer: translations,
            divisor: 1
        },
        scale: {
            buffer: scales,
            divisor: 1
        },
        model_c1: {
            buffer: models.map(model => model.slice(0, 4)),
            divisor: 1
        },
        model_c2: {
            buffer: models.map(model => model.slice(4, 8)),
            divisor: 1
        },
        model_c3: {
            buffer: models.map(model => model.slice(8, 12)),
            divisor: 1
        },
        model_c4: {
            buffer: models.map(model => model.slice(12, 16)),
            divisor: 1
        },
        num_instances: translations.length,
        light_position: light_position_cam,
        view: mat_view,
        projection: mat_projection
    });
}
```

In `mesh.js`
```js
// some meshes do not have face normals in the obj file
// so we calculate them from the verties here
export function build_mesh_normals(mesh){

	// check if the mesh obj has face normals
	if(isNaN(mesh.vertex_normals[0])){
		mesh.vertex_normals = []
		for(let i = 0; i < mesh.faces.length/3; i++){
			let idxs = [0, 1, 2].map(j => mesh.faces[3*i + j])
			let vertices = idxs.map(j => mesh.vertex_positions.slice(3*j, 3*j+3))

			let line1 = vec3.sub(vec3.create(), vertices[1], vertices[0])
			let line2 = vec3.sub(vec3.create(), vertices[2], vertices[0])

			let normal = vec3.create();
			vec3.cross(normal, line2, line1);
			mesh.vertex_normals.push(...normal)
		}
	}

	return mesh;
}
```

In `birds.js`

Note: this is just the declaration of a standard regl pipeline, which is a very common code. I am not sure if I need to include this since it may not qualify entirely as *original*. But including it since thinking what parameters to pass to the shader file and whether they should be attributes/uniform was original work. 

```js
// function to draw birds on the scene
export function draw_birds(regl, resources, terrain_mesh, globalTime, mat_projection, mat_view, light_position_cam){

    // get the bird mesh
    // this function adds face normals into the mesh
    const bird_mesh = build_mesh_normals(resources['bird2.obj'])

    const birds_in_terrain = regl({
        frag: resources[`shaders/bird.frag.glsl`],
        vert: resources[`shaders/bird.vert.glsl`],
    
        attributes: {		
            position: bird_mesh.vertex_positions,
            normal: bird_mesh.vertex_normals,
            // passed as an attribute to avoid globalTime having different value for
            // different vertices since the shader code does not run for them at the same time
            globalTime: Array(bird_mesh.vertex_positions.length).fill(globalTime),
    
            // instance attributes
            offset: regl.prop('offset'),
            scale: regl.prop('scale'),
            // need to pass these as separate rows since regl does not support mat4 as an attribute
            model_c1: regl.prop('model_c1'),
            model_c2: regl.prop('model_c2'),
            model_c3: regl.prop('model_c3'),
            model_c4: regl.prop('model_c4'),
        },
    
        elements: bird_mesh.faces,
        instances: regl.prop('num_instances'),
        
        uniforms: {
            view: regl.prop('view'),
            projection: regl.prop('projection'),
            light_position: regl.prop('light_position')
        }
      })

    
    // base value of a bird
    const BIRD_SCALE = 1 / 250;
    // the offsets and scales for placing the birds
    let { translations, scales, models } = get_positions(BIRD_THRESH, terrain_mesh, BIRD_SCALE, true)

    // draw the birds on the scene
    draw_pipeline(birds_in_terrain, light_position_cam, mat_view, mat_projection, translations, scales, models)
}
```

In `trees.js`

Note: similar to the code as in `birds.js`

```js
// function to draw trees on the scene
export function draw_trees(regl, resources, terrain_mesh, mat_projection, mat_view, light_position_cam){

	// get the tree mesh
    // this function adds face normals into the mesh
    const tree_mesh = build_mesh_normals(resources['tree2.obj'])

    const tree_in_terrain = regl({
		frag: resources["shaders/tree.frag.glsl"],
		vert: resources["shaders/tree.vert.glsl"],
	
		attributes: {		
			position: tree_mesh.vertex_positions,
			normal: tree_mesh.vertex_normals,

			// each vertex has a different color depending upon whether that vertex is
			// present on the leaves or the trunk
			color: tree_mesh.vertex_colors,

			// instance attributes
			offset: regl.prop('offset'),
			scale: regl.prop('scale'),

			// need to pass these as separate rows since regl does not support mat4 as an attribute
			model_c1: regl.prop('model_c1'),
			model_c2: regl.prop('model_c2'),
			model_c3: regl.prop('model_c3'),
			model_c4: regl.prop('model_c4'),
		},

		elements: tree_mesh.faces,
		instances: regl.prop('num_instances'),
	  
		uniforms: {
			light_position: regl.prop('light_position'),
			view: regl.prop('view'),
			projection: regl.prop('projection'),
			viewer_scale: 1.0,
			// the mouse offset is used to move the trees when the terrain is moved
			viewer_position: [-MouseCoordinates.mouse_offset_X, -MouseCoordinates.mouse_offset_Y]
		}
	  })

	// base size of a tree
	const TREE_SCALE = 1/20
	// the offsets and scales for placing the trees
	let {translations, scales, models} = get_positions(TREE_THRESH, terrain_mesh, 1/20);
	
	// draw the trees on the scene
    draw_pipeline(tree_in_terrain, light_position_cam, mat_view, mat_projection, translations, scales, models)
}
```

In `terrain.js`

```js
draw_trees(regl, resources, terrain_mesh, mat_projection, mat_view, light_position_cam)
draw_birds(regl, resources, terrain_mesh, globalTime, mat_projection, mat_view, light_position_cam)
```

In `tree.vert.glsl`

```glsl
...
// create model and associated matrices
mat4 model = mat4(model_c1, model_c2, model_c3, model_c4);
mat3 mat_normals = inverse(transpose(mat3(view * model)));
...
if(height > 0.){
		// if terrain point exists on land then draw the tree
	gl_Position = projection * view * model * vec4(position.xy + offset.xy, position.z + height / scale, 1);
}
else{
	// if terrain point exists on water, ignore the tree
	gl_Position = vec4(1., 1., 1., 1.);
}
...
```

**Animate birds/fish in an elaborate pattern, perhaps using noise functions as velocity field.**
```glsl
...
// create model and associated matrices
mat4 model = mat4(model_c1, model_c2, model_c3, model_c4);

// position of vertices of bird mesh in the scene
vec3 scene_position = position + offset;
vec3 noise = perlin_noise(vec2(offset.x + 100. * sin(globalTime), offset.y + 100. * sin(globalTime)));

if(sin(globalTime) < 0.)
	gl_Position = projection * view * model *vec4(scene_position.x + 4000. * sin(globalTime) * noise.x,  scene_position.y + 4000. * sin(globalTime) * noise.x, scene_position.z - 80. * noise.x, 1);
else
	gl_Position = projection * view * model *vec4(scene_position.x - 4000. * sin(globalTime) * noise.x,  scene_position.y - 4000. * sin(globalTime) * noise.x, scene_position.z - 80. * noise.x, 1);	
...
```
