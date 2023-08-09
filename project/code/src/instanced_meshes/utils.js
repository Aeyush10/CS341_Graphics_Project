import { MouseCoordinates } from "../shared.js";
import { mat4, quat } from "../../lib/gl-matrix_3.3.0/esm/index.js"
import { fromEuler } from "../../lib/gl-matrix_3.3.0/esm/quat.js"
import { MIN_TERRAIN_VAL, GRID_HEIGHT, GRID_WIDTH } from "../constants.js";

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