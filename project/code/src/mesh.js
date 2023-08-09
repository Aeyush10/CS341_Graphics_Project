import {vec3} from "../lib/gl-matrix_3.3.0/esm/index.js"
import { MIN_TERRAIN_VAL } from "./constants.js"
import { GRID_HEIGHT, GRID_WIDTH } from "./constants.js"

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

export function terrain_build_mesh(time) {
	const grid_width = GRID_WIDTH
	const grid_height = GRID_HEIGHT

	const WATER_LEVEL = -0.03125

	const vertices = []
	const faces = []


	// Map a 2D grid index (x, y) into a 1D index into the output vertex array.
	function xy_to_v_index(x, y) {
		return x + y*grid_width
	}
	for(let gy = 0; gy < grid_height; gy++) {
		for(let gx = 0; gx < grid_width; gx++) {
			const idx = xy_to_v_index(gx, gy)
			vertices[idx] = [gx/grid_height - MIN_TERRAIN_VAL, gy/grid_width - MIN_TERRAIN_VAL]
		}
	}

	for(let gy = 0; gy < grid_height - 1; gy++) {
		for(let gx = 0; gx < grid_width - 1; gx++) {
			/* 
			Triangulate the grid cell whose lower lefthand corner is grid index (gx, gy).
			You will need to create two triangles to fill each square.
			*/
			const i1 = xy_to_v_index(gx, gy);
			const i2 = xy_to_v_index(gx+1, gy);
			const i3 = xy_to_v_index(gx, gy+1);
			const i4 = xy_to_v_index(gx+1, gy+1);

			faces.push([i1, i2, i3]);
			faces.push([i2, i4, i3]);
		}
	}

	return {
		vertex_positions: vertices,
		faces: faces,
	}
}