import { mat3, mat4 } from "../lib/gl-matrix_3.3.0/esm/index.js"
import { mat4_matmul_many } from "./icg_utils/icg_math.js"

import { terrain_build_mesh } from "./mesh.js"
import { MouseCoordinates } from "./shared.js"

import { CamVariables } from "./shared.js"

import { draw_birds } from "./instanced_meshes/birds.js"
import { draw_trees } from "./instanced_meshes/trees.js"

//Function now takes globalTime as a parameter
export function init_terrain(regl, resources, globalTime) {

	//This function now takes globalTime as a parameter
	const terrain_mesh = terrain_build_mesh(globalTime)

	const pipeline_draw_terrain = regl({
		attributes: {
			position: terrain_mesh.vertex_positions		
		},
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
			mat_model_view: regl.prop('mat_model_view'),
			mat_normals: regl.prop('mat_normals'),
			water_cubemap: regl.prop('cubemap'),
			globalTime: globalTime,
			light_position: regl.prop('light_position'),
			camera_direction: CamVariables.cam_target,
			viewer_scale: 1.0,
			// viewer position is needed to update the mesh when the terrain is moved
			// this creates an illusion of infinite terrain
			viewer_position: [-MouseCoordinates.mouse_offset_X, -MouseCoordinates.mouse_offset_Y]
		},
		elements: terrain_mesh.faces,
		vert: resources['shaders/terrain.vert.glsl'],
		frag: resources['shaders/terrain.frag.glsl'],
	})


	class TerrainActor {
		constructor() {
			this.mat_mvp = mat4.create()
			this.mat_model_view = mat4.create()
			this.mat_normals = mat3.create()
			this.mat_model_to_world = mat4.create()
		}
		
		draw_terrain(mat_projection, mat_view, light_position_cam){
			mat4_matmul_many(this.mat_model_view, mat_view, this.mat_model_to_world)
			mat4_matmul_many(this.mat_mvp, mat_projection, this.mat_model_view)
	
			mat3.fromMat4(this.mat_normals, this.mat_model_view)
			mat3.transpose(this.mat_normals, this.mat_normals)
			mat3.invert(this.mat_normals, this.mat_normals)
	
			pipeline_draw_terrain({
				mat_mvp: this.mat_mvp,
				mat_model_view: this.mat_model_view,
				mat_normals: this.mat_normals,
				globalTime: this.globalTime,
				light_position: light_position_cam,
				cubemap: resources['cubemap']
			})
		}
		

		

		draw({mat_projection, mat_view, light_position_cam}) {
				this.draw_terrain(mat_projection, mat_view, light_position_cam)
				draw_trees(regl, resources, terrain_mesh, mat_projection, mat_view, light_position_cam)
				draw_birds(regl, resources, terrain_mesh, globalTime, mat_projection, mat_view, light_position_cam)
		}
	}

	return new TerrainActor()
}
