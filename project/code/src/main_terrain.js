import {createREGL} from "../lib/regljs_2.1.0/regl.module.js"
import {vec2, vec4, mat2, mat4} from "../lib/gl-matrix_3.3.0/esm/index.js"

import {DOM_loaded_promise, load_text, register_keyboard_action} from "./icg_utils/icg_web.js"
import {deg_to_rad, mat4_matmul_many} from "./icg_utils/icg_math.js"

import { icg_mesh_load_obj_into_regl } from "./icg_utils/icg_mesh.js"
import {load_image} from "./icg_utils/icg_web.js"

import {init_terrain} from "./terrain.js"

import { GRID_HEIGHT, MATERIAL_COLORS_BY_NAME } from "./constants.js"
import { MouseCoordinates } from "./shared.js"


import { CamVariables } from "./shared.js"

async function main() {
	/* const in JS means the variable will not be bound to a new value, but the value can be modified (if its an object or array)
		https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
	*/

	const debug_overlay = document.getElementById('debug-overlay')

	// We are using the REGL library to work with webGL
	// http://regl.party/api
	// https://github.com/regl-project/regl/blob/master/API.md

	const regl = createREGL({ // the canvas to use
		profile: true, // if we want to measure the size of buffers/textures in memory
		extensions: ['oes_texture_float', 'ANGLE_instanced_arrays'], // enable float textures
	})

	// The <canvas> (HTML element for drawing graphics) was created by REGL, lets take a handle to it.
	const canvas_elem = document.getElementsByTagName('canvas')[0]


	let update_needed = true
	//Setting time for the purposes of animation
	let globalTime = 0.
	
	{
		// Resize canvas to fit the window, but keep it square.
		function resize_canvas() {
			canvas_elem.width = window.innerWidth
			canvas_elem.height = window.innerHeight

			update_needed = true
		}
		resize_canvas()
		window.addEventListener('resize', resize_canvas)
	}

	/*---------------------------------------------------------------
		Resource loading
	---------------------------------------------------------------*/

	/*
	The textures fail to load when the site is opened from local file (file://) due to "cross-origin".
	Solutions:
	* run a local webserver
		caddy file-server -browse -listen 0.0.0.0:8000 -root .
		# or
		python -m http.server 8000
		# open localhost:8000
	OR
	* run chromium with CLI flag
		"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --allow-file-access-from-files index.html

	* edit config in firefox
		security.fileuri.strict_origin_policy = false
	*/

	// Start downloads in parallel
	const resources = {};

	[
		"terrain.vert.glsl",
		"terrain.frag.glsl",

		"tree.vert.glsl",
		"tree.frag.glsl",

		"bird.vert.glsl",
		"bird.frag.glsl"

	].forEach((shader_filename) => {
		resources[`shaders/${shader_filename}`] = load_text(`./src/shaders/${shader_filename}`)
	});
	
	const posX = await load_image('cubemap_imgs/sky_posX.png')
	const negX = await load_image('cubemap_imgs/sky_negX.png')
	const posY = await load_image('cubemap_imgs/sky_posY.png')
	const negY = await load_image('cubemap_imgs/sky_negY.png')
	const posZ = await load_image('cubemap_imgs/sky_posZ.png')
	const negZ = await load_image('cubemap_imgs/sky_negZ.png')
	const cubeimages = [posX,negX,posY,negY,posZ,negZ]

	const cube = regl.cube(...cubeimages)
	resources['cubemap'] = cube

	// Wait for all downloads to complete
	for (const key of Object.keys(resources)) {
		resources[key] = await resources[key]
	}

	// meshes
	const meshes_to_load = [
		"tree2.obj", "bird2.obj"
	]
	for(const mesh_name of meshes_to_load) {
		if(mesh_name == 'tree2.obj'){
			resources[mesh_name] = await icg_mesh_load_obj_into_regl(regl, `./meshes/${mesh_name}`, MATERIAL_COLORS_BY_NAME)
		}
		else{
			resources[mesh_name] = await icg_mesh_load_obj_into_regl(regl, `./meshes/${mesh_name}`)
		}
	}

	/*---------------------------------------------------------------
		Actors
	---------------------------------------------------------------*/
	//Function modified to pass in globalTime
	let terrain_actor = init_terrain(regl, resources, globalTime) 
	
	function terrain_actor_update() {
		terrain_actor = init_terrain(regl, resources, globalTime)
		update_needed = true
	}
	//Call terrain_actor_update every 33.3 ms (about 30 FPS)
	window.setInterval(terrain_actor_update, 1000.0/30.0) 

	/*---------------------------------------------------------------
		Camera
	---------------------------------------------------------------*/
	const mat_turntable = mat4.create()
	const cam_distance_base = 0.75

	let cam_angle_z = -0.5 // in radians!
	let cam_angle_y = -0.42 // in radians!
	let cam_distance_factor = 1.
	let cam_up_vec = [0, 0, 1]
	let cam_y = 0
	let cam_z = 0.3

	function update_cam_transform(rot = 1) {
		/* #TODO PG1.0 Copy camera controls
		* Copy your solution to Task 2.2 of assignment 5.
		Calculate the world-to-camera transformation matrix.
		The camera orbits the scene
		* cam_distance_base * cam_distance_factor = distance of the camera from the (0, 0, 0) point
		* cam_angle_z - camera ray's angle around the Z axis
		* cam_angle_y - camera ray's angle around the Y axis

		* cam_target - the point we orbit around
		*/

		// Example camera matrix, looking along forward-X, edit this
		const look_at = mat4.lookAt(mat4.create(), 
			//[cam_distance_base * cam_distance_factor*Math.cos(cam_angle_y)*Math.cos(cam_angle_z), cam_distance_base * cam_distance_factor*Math.cos(cam_angle_y)*Math.sin(cam_angle_z), cam_distance_base * cam_distance_factor*Math.sin(cam_angle_y)], // camera position in world coord
			[-cam_distance_base * cam_distance_factor, cam_y, cam_z],// camera position in world coord
			CamVariables.cam_target, // view target point
			cam_up_vec, // up vector
		)
		if (rot == 1)
		{const matzrot = mat4.fromZRotation(mat4.create(),cam_angle_z)
		const matyrot = mat4.fromYRotation(mat4.create(),cam_angle_y)
		mat4_matmul_many(mat_turntable, look_at, matyrot,matzrot)}
		else
		{
			mat4_matmul_many(mat_turntable, look_at)
		}
		// Store the combined transform in mat_turntable
		// frame_info.mat_turntable = A * B * ...
	}

	update_cam_transform()

	// Prevent clicking and dragging from selecting the GUI text.
	canvas_elem.addEventListener('mousedown', (event) => { event.preventDefault() })

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
		terrain_actor = init_terrain(regl, resources, globalTime)
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
	
	// Rotate camera position by dragging with the mouse
	window.addEventListener('mousemove', (event) => {
		// if left or middle button is pressed
		if (event.buttons & 1 || event.buttons & 4) {
			if (event.shiftKey) {
				const r = mat2.fromRotation(mat2.create(), -cam_angle_z)
				const offset = vec2.transformMat2([0, 0], [event.movementY, event.movementX], r)
				vec2.scale(offset, offset, -0.01)
				CamVariables.cam_target[0] += offset[0]
				CamVariables.cam_target[1] += offset[1]
			} else {
				cam_angle_z += event.movementX*0.005
				cam_angle_y += -event.movementY*0.005
			}
			update_cam_transform()
			update_needed = true
		}

	})


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
		//Every call to init_terrain must now pass in globalTime
		terrain_actor = init_terrain(regl, resources, globalTime)
		update_needed = true
	})

	window.addEventListener('wheel', (event) => {
		// scroll wheel to zoom in or out
		const factor_mul_base = 1.08
		const factor_mul = (event.deltaY > 0) ? factor_mul_base : 1./factor_mul_base
		cam_distance_factor *= factor_mul
		cam_distance_factor = Math.max(0.1, Math.min(cam_distance_factor, 4))
		event.preventDefault() // don't scroll the page too...
		update_cam_transform()
		update_needed = true
	})

	/*
		UI
	*/
	register_keyboard_action('z', () => {
		debug_overlay.classList.toggle('hide')
	})


	function activate_preset_view() {
		cam_angle_z = -1.0
		cam_angle_y = -0.42
		cam_distance_factor = 1.0
		CamVariables.cam_target = [0, 0, 0.2]
		
		update_cam_transform(0)
		update_needed = true
	}
	activate_preset_view()

	/*---------------------------------------------------------------
		Frame render
	---------------------------------------------------------------*/
	const mat_projection = mat4.create()
	const mat_view = mat4.create()

	let light_position_world = [0.2, -0.3, 0.8, 1.0]

	const light_position_cam = [0, 0, 0, 0]

	regl.frame((frame) => {

		//increment the globalTime variable using the frame time
		globalTime = frame.time * 0.001; // Convert frame time to seconds

		if(update_needed) {
			update_needed = false // do this *before* running the drawing code so we don't keep updating if drawing throws an error.

			mat4.perspective(mat_projection,
				deg_to_rad * 60, // fov y
				frame.framebufferWidth / frame.framebufferHeight, // aspect ratio
				0.01, // near
				100, // far
			)

			mat4.copy(mat_view, mat_turntable)

			// Calculate light position in camera frame
			vec4.transformMat4(light_position_cam, light_position_world, mat_view)

			const scene_info = {
				mat_view:        mat_view,
				mat_projection:  mat_projection,
				light_position_cam: light_position_cam
			}

			// Set the whole image to black
			regl.clear({color: [0.9, 0.9, 1., 1]})

			terrain_actor.draw(scene_info)
		}
	})
}

DOM_loaded_promise.then(main)
