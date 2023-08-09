---
title: A Whole New World
---

<figure>
<video src="images/water_animation.mov" width="600" controls=""><a href="images/water_animation.mov">Summary of the project features</a></video><figcaption aria-hidden="true">Summary of the project features</figcaption>
</figure>

# Abstract

A visually interesting and infinitely procedurally generated landscape is generated using the code of exercise PG1 as a base and adding the six following elements to it:

1. Creation of infinite terrain: as opposed to the static landscape in the exercise code, we generate an infinite landscape.
2. Shader implementation: In contrast to the exercise code, where normals were being calculated in the javascript files using the mesh points, we use analytic normals by using the derivative of the noise function in the shader.
3. Animated waves: we add waves onto the water to give a live effect using 3D Perlin noise rather than 2D noise from the exercise.
4. Camera movement: we implement camera paths using Bézier curves for a cinematic view of the terrain.
5. Trees and birds: we add randomly scattered trees of different shape and sizes and birds with random velocities using instance rendering.
6. Reflection of sky in water: We use a 3D cubemap to give a reflective view to the water.

# Technical Approach

<details>
  <summary style="cursor:pointer; font-size: 24px">**Setting terrain shape in vertex shader**</summary>
  
  In the original code of PG1 exercise, there was a buffer which stored the values of elevation of the terrain (the elevation was calculated using the noise functions of perlin noise). But now I eliminate the use of buffer altogether and calculate the elevation inside the terrain.vert.glsl file. To achieve this, I first import the code for noise from PG1 exercise into the terrain.vert.glsl file and then calculate the elevation using the noise function. The tricky part here was understanding the GPU pipeline.

  ### Code
  ```glsl
vec2 local_coord =  2. * position.xy * viewer_scale;
vec2 v2f_tex_coords = viewer_position + local_coord;
vec3 noise_value = tex_fbm_for_terrain(v2f_tex_coords);

// noise value lies in the range (0,1) so we subtract 0.5 to get it in the range (-0.5,0.5)
v2f_height = noise_value.x - 0.5;
  ```

  The above code, present in `terrain.vert.glsl` demonstrates this. The first line calculates the local coordinates of a vertex of the mesh of the terrain. The `2.` is multiplied to convert the points from `(-0.5, 0.5)` to `(-1, 1)`. In the next line, the local position is offset by the viewer position to get the global coordinates. Finally in line 3 noise function is invoked to get the noise value. And in line 4, the noise value is converted from `(0, 1)` to `(-0.5, 0.5)`. The end result is that the variable `v2f_height` holds the value of elevation at a given point. 

</details>


<details>
  <summary style="cursor:pointer; font-size: 24px">**Calculating the normals in the shader**</summary>
  
  In the exercise PG1 code, the normals are calculated in the JavaScript files by taking the approximate derivatives. Now I use the derivative of the perlin noise function to calculate the normals inside the terrain.vert.glsl file. The expression for derivative in perlin noise was taken from a resource on the internet. 

  It is to be noted that the terrain elevation is not calculated using the perlin noise, but instead using the function `tex_fbm_for_terrain` from the exercise code. So the derivative of Perlin Noise had to be propagated through the functions `perlin_fbm` and `tex_fbm_for_terrain`  which I did myself. 

  ### Code
  ```glsl
  vec3 perlin_fbm(vec2 point) {
      vec3 fbm = perlin_noise(point);
      float a = ampl_multiplier;
      float omega = freq_multiplier;
      for(int i = 1; i < num_octaves; i++) {
        vec3 new_octave = a * perlin_noise(point * omega);
        // new_octave.yz has to be multiplied by omega in accordance with chain rule
        fbm += vec3(new_octave.x, new_octave.yz * omega);
        a = a * a;
        omega = omega * omega;
      }
      return fbm;	
  }

  vec3 tex_fbm_for_terrain(vec2 point) {
      // scale by 0.25 for a reasonably shaped terrain
      // the +0.5 transforms it to 0..1 range - for the case of writing it to a non-float textures on older browsers or GLES3
      // add 0.5 only to noise, not to the derivatives

      // the y and z components of the addition vector are 0 since adding a constant
      // does not change the value of derivative
      vec3 noise_val = (perlin_fbm(point) * 0.25) + vec3(0.5, 0., 0.);
      return noise_val;
   }
  ```

  The above code, present in `terrain.vert.glsl` demonstrates this. The first function calculates `fbm` using `perlin_noise` function. Note that the output of `perlin_noise` function is a 3D vector whose x value represents the noise value, and the y and z components represent the derivative of the noise with respect to x and y respectively. This derivative of perlin noise has to be propagated across the remaining functions. In `perlin_fbm` function, the line `fbm += vec3(new_octave.x, new_octave.yz * omega);` propagates the gradient. The need to multiply by `omega` is due to the chain rule. 

  Finally in the function `tex_fbm_for_terrain`, the `0.5` is added to transform the value from `(-0.5, 0.5)` to `(0, 1)`. Here, we do not need to transform the derivative, since a constant is being added to the noise. Hence the y and z component of the additive vector in `vec3 noise_val = (perlin_fbm(point) * 0.25) + vec3(0.5, 0., 0.);` are `0`.  
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**Illusion of inifinite travel over the terrain**</summary>

I observed that in the code for PG1, the variable `mouse_offset` is being used for the viewer position. The key point to complete this part was to note that the global position of a point will be `position_in_the_mesh - mouse_offset`. So to create an illusion of infinite terrain, I update the `mouse_offset`. On pressing the `LeftArrow`/`RightArrow` key, I update the `X` coordinate of `mouse_offset` and on pressing the `UpArrow`/`DownArrow` key, I update the `Y` coordinate of `mouse_offset`. 

After updating the `mouse_offset`, I set the variable `update_needed` to be true, which re-renders the scene and the landscape appears shifted.

### Code
```js
...
const step_size = 2./GRID_HEIGHT
if(event.key == 'ArrowRight') MouseCoordinates.mouse_offset_X -= step_size
else if(event.key == 'ArrowLeft') MouseCoordinates.mouse_offset_X += step_size
else if(event.key == 'ArrowUp') MouseCoordinates.mouse_offset_Y -= step_size
else if(event.key == 'ArrowDown') MouseCoordinates.mouse_offset_Y += step_size
...
update_needed = true
```

Note that we cannot choose any step size here. It was carefully chosen to be this value to allow the trees to move easily along with the movement of terrain. As we will see next, I add trees onto the terrain using instancing. The trees have been placed on vertices of the mesh. So when the terrain is moved, the trees need to be moved such that the vertex they remain on is fixed. Hence the step size is chosen as the distance between two vertices of the mesh.
    
</details>



<details>
  <summary style="cursor:pointer; font-size: 24px">**Instance rendering of simple meshes for birds / fish / trees**</summary>

I use the example [here](https://github.com/regl-project/regl/blob/gh-pages/example/instance-mesh.js) to understand instancing. I use instance rendering to render trees and birds.
```js
regl({
    ...
    attributes: {		
        ...
        // instance attributes
        offset: regl.prop('offset'),
        scale: regl.prop('scale'),
        model_c1: regl.prop('model_c1'),
        model_c2: regl.prop('model_c2'),
        model_c3: regl.prop('model_c3'),
        model_c4: regl.prop('model_c4'),
    },

    ...,
    instances: regl.prop('num_instances'),
    
    uniforms: {
        light_position: regl.prop('light_position'),
        view: regl.prop('view'),
        projection: regl.prop('projection'),
        ...
    }
})
```

Implementing this was the trickiest portion of the project as I encountered various issues:

* **Finding tree mesh:** Firstly, finding the suitable mesh for the tree was a very tough task, since most of the files that I found were of very large size and could not be rendered. Once I found the mesh, I went through the pipeline of GL3 to understand how to use that mesh.

```js
const meshes_to_load = [ "tree2.obj", "bird2.obj" ]
for(const mesh_name of meshes_to_load) {
    ...
    resources[mesh_name] = await icg_mesh_load_obj_into_regl(regl, `./meshes/${mesh_name}`)
    ...
}
```


* **Size of trees:** To make the trees of random sizes, I scale the trees based on a random number generated using the tree's global coordinates. 

```js
...
let scale = Math.exp(1 / (hash_num - thresh)) * scale_base
...
```
Here the scale is a scaling factor for determining the size of the tree.

I use an exponential function for this part, because it gave sufficient variability in the different tree sizes.

* Passing model matrix: Since the trees are of different sizes, we need a different `model_to_world` matrix for each tree. So this variable is no longer a uniform, since it is different for every tree rendered in the scene. In fact this is now an instance attribute. I did not know that we can only pass primitive datatypes as attributes in the regl framework (model matrix is a `mat4`). So I was stuck for a long time in figuring out why is my code not working. Finally I passed the columns of model matrix separately from the javascript files and combined those columns in the shader code to make the model matrix. Also, since I need the inverse of transpose of model view matrix, and these functions are not supported by the WebGL API, I had to import the implementation of these functions from the internet. 

```js
...
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
...
```

Then inside the shader:
```c
...
mat4 model = mat4(model_c1, model_c2, model_c3, model_c4);
mat3 mat_normals = inverse(transpose(mat3(view * model)));
...
```
The implementation of functions `inverse` and `transpose` was taken from the internet.


* Positioning of trees: This was another challenge where I spent a lot of time. I wanted to position the trees randomly on a terrain. Since the landscape is infinite, when the landscape is scrolled, the trees are expected to adjust accordingly. Therefore, the fact that a given point in space should contain a tree should be a function of that point's global coordinates. The next hurdle is that if we use a noise function such as the perlin noise function, it is a continuous function. So if a tree exists at a point `(x, y)`, with very high probabililty a tree will also exist at point `(x+dx, y+dy)`. So I needed a function such that the probability a tree exists at `(x, y)` is independent of the probability that the tree exists at `(x+dx, y+dy)`. In other words, the function should be discontinuous. One class of functions that satisfies this criteria are the cryptographic hash functions. So I decided to use SHA256 hash function using the `CryptoJS` library to calculate a hash value for each point in the landscape. Then I threshold on the hash value to determine if a tree should exist at that place. More details on this can be found at the end of the report. 
* Calculating normals: For lighting the tree, I needed the normals of the surface of the tree. Since the mesh that I found did not contain these normals already, I had to calculate these myself. For every triangular face of the mesh, I calculate the normal by taking the cross product of the two sides of the triangle.

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
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**Animate birds/fish in an elaborate pattern, perhaps using noise functions as velocity field.**</summary>

This was relatively simple after having done instance rendering for the trees. The key point here was to define the movement of the birds using the noise functions to make the landscape more realistic. 

 The constants chosen in the code produced the best result with the birds varying their positions in all three dimensions at a reasonable speed. We also tune the constants that affect the z position in such a way that the birds fly close to the level of the terrain, but never so close that they fly "through" the terrain. Additionally, it is necessary to apply a sine function to the globalTime variable because it always increases. Without the sine function, the birds' movement became more and more erratic over time and would eventually go off screen. 
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**Bezier Curves**</summary>

I made the curves using the explicit (non-recursive) formula. The function I made to calculate the bezier curve works for any number of fixed points in the curve, however in the final curves I made I only used sets of 5 points. Based on user input, the user can see one of three curves: one circular around the center, and two of them making an '8' like shape around the terrain. The '8' shape is made using 4 bezier curves, the terminal points being the center and one corner point. I move the camera along this path and keep the camera target at a point just ahead in the same shape (for these 2 paths). I also move 'Mouse Coordinates' that simulate travel along the terrain to give a better visual feel.
I execute the continuous movement by calling the camera movement function every few milliseconds, and I move along the curve on the basis of time. Each curve is executed within one 'second' of a new time variable that is a multiple of the globalTime, and the fractional part of this 'second' provides the 't' for the function that returns the desired position of the camera.
The main_terrain file can access globalTime and can call the code to update the camera parameters, which is why I wrote the code for this part here.
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**Water Reflection***</summary>

I initially just created a 2D texture using a photo of the sky. I did this by loading this texture, then adding it to the resources (so that I can await the promise) and then making it a part of the uniforms. I eventually scrapped this texture as it did not provide reflections.
Using 6 images of the sky that form a cubemap, I made a regl.cube object and similarly to the 2D texture created a uniform for this cubemap that I passed to the fragment shader as a samplerCube object. 
I calculated the reflected direction using the view vector (which now had to take into account the camera target since it is not always the center) and the surface normals, which I had to manually implement as the the position of the water was a non-trivial function of the 2D noise we had used. Then, I used the textureCube function to apply the cubemap to the points in the water.    
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**Setting up globalTime variable**</summary>

Since our project involves animations with animated water waves and Bézier curves, it was important to set up a time variable that was continuously changing. This was done in the main_terrain.js file, where it is initialized to zero. The variable gets incremented in the frame render loop, where it is possible to set it to the time attribute of the frame, which increases linearly. Then, the variable is stored as a uniform so that it can be used in the glsl files. 
</details>

<details>
  <summary style="cursor:pointer; font-size: 24px">**3D waves and 3D Perlin noise**</summary>
3D Perlin noise is implemented by extending the method for 2D Perlin noise into the third dimension. There are now eight integer points in the lattice surrounding a point and interpolation must be done between the contributions of each. The code for 3D Perlin noise was taken from this website and no modifications were made to it.

To implement the animated waves, the 3D Perlin noise function is called in the terrain vertex shader file. When a vertex’s z-position is below the water level, its position is transformed by first a call to a sine function to create a sinusoidal wave effect. This is then multiplied by a call to the 3D Perlin noise function, which takes the time variable as input, in order to introduce variation and pseudo-randomness to the wave. Finally, the modified position is transformed by the model-view-projection matrix to render the new position onto the screen.

Of course, modifying the water’s vertex positions must constantly be done to produce a smooth animation. Thus, in the main_terrain.js file, the init_terrain function is modified to be called every 33.3 milliseconds (or 30 frames per second) rather than just once. The update_needed boolean is also set to true, allowing the code that updates the time variable in the render loop to run. This allows the water vertex positions to constantly change to create the wave effect.

See the results section below for the resulting wave animation.

Problems encountered:

There were several initial attempts to create animated waves which failed. The first attempt involved trying to edit the fragment shader file in order to change the color of the water. This did not work because we only managed to get all the water pixels to change to the same color rather than each individual pixel. Additionally, it was not possible to change the height of the water here to create the wave effect. Another attempt involved trying to dynamically change the water level threshold based on position in the mesh.js file. However, we were not able to incorporate the time variable here. The third attempt was the correct solution, which is the modification of the vertex positions described above.
</details>

# Results

**Screenshot of overall view of the project**

<figure>
<img src="images/Overall view.png" width="600" alt="Overall view of the project" /><figcaption aria-hidden="true">Overall view of the project</figcaption>
</figure>

**Illusion of infinite terrain and tree instance rendering**
<figure>
<video src="images/Infinite terrain.mp4" width="600" controls=""><a href="images/Infinite terrain.mp4">Use the arrow keys to move infinitely in any direction</a></video><figcaption aria-hidden="true">Use the arrow keys to move infinitely in any direction. We also see the trees being generated at random locations on ground and of random sizes.</figcaption>
</figure>

**Instance rendering and animation of birds**
<figure>
<video src="images/animated_birds.mp4" width="600" controls=""><a href="images/animated_birds.mp4">Birds with pseudo random movements in three dimensions</a></video><figcaption aria-hidden="true">Birds with pseudo random movements in three dimensions</figcaption>
</figure>

**Bézier curves**

<figure>
<video src="images/bezier_1.mov" width="600" controls=""><a href="images/bezier_1.mov">Bézier curve #1</a></video><figcaption aria-hidden="true">Bézier curve #1</figcaption>
</figure>

<figure>
<video src="images/bezier_2.mov" width="600" controls=""><a href="images/bezier_2.mov">Bézier curve #2</a></video><figcaption aria-hidden="true">Bézier curve #2</figcaption>
</figure>

<figure>
<video src="images/bezier_3.mov" width="600" controls=""><a href="images/bezier_3.mov">Bézier curve #3</a></video><figcaption aria-hidden="true">Bézier curve #3</figcaption>
</figure>

**Water reflection and animation**

<figure>
<video src="images/water_animation.mov" width="600" controls=""><a href="images/water_animation.mov">Bézier curve #3</a></video><figcaption aria-hidden="true">Water waves and the reflection of sky from a cubemap</figcaption>
</figure>

# Contributions

| Team Member | Work Done | %age contribution of total workload |
| ----------- | ----------- | ----------- |
| Gurnoor | Understood the working of regl pipeline, implemented the terrain shape and normals in vertex shader. Created the illusion of infinite travel on the terrain. Rendered randomly placed trees of different sizes using instancing in regl. Rendered the birds and gave them animation.  | 40% |
| Lawrence | Researched 3D Perlin noise, implemented and set up the globalTime variable, implemented animated waves, helped with bird animation, and voiced the video presentation. | 27% |
| Aayush | Implemented Bézier curve animations and water reflections using the cubemap, applied proper reflection to the animated waves, edited the video presentation. | 33% |

# Resources

Implementing noise on GPU: http://www.sci.utah.edu/~leenak/IndStudy_reportfall/Perlin%20Noise%20on%20GPU.html

Texture Generation:
https://www.redblobgames.com/maps/terrain-from-noise/

CS-341 Exercise PG-1:
https://moodle.epfl.ch/mod/assign/view.php?id=1065258

Implementing 3D Perlin Noise for Clouds:
https://www.cs.carleton.edu/cs_comps/0405/shape/marching_cubes.html

3D Perlin noise function: 
https://gpfault.net/posts/perlin-noise.txt.html

Water 2D Texture (Unused finally): 
https://www.freepik.com/free-vector/abstract-blue-sky-background_37272502.htm#query=sky%20texture&position=5&from_view=keyword&track=ais

Understanding shaders and GL pipeline: https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html

Understanding shaders and GL pipeline: https://webglfundamentals.org/webgl/lessons/webgl-how-it-works.html

Understanding shaders and GL pipeline: https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html

Creating illusion of inifinite terrain: https://github.com/raveenajain/Infinite-Terrain

Creating illusion of infinite terrain: https://www.youtube.com/watch?v=NPyPkpYyxXI&ab_channel=IanBarnard

Derivative of perlin noise: https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/perlin-noise-part-2/perlin-noise-computing-derivatives.html

Derivative of perlin noise: https://iquilezles.org/articles/gradientnoise/

Function for transpose of a matrix in glsl: https://stackoverflow.com/questions/18034677/transpose-a-mat4-in-opengl-es-2-0-glsl

Function for inverse of a matrix in glsl: https://github.com/glslify/glsl-inverse/blob/master/index.glsl

Meshes for trees and birds: these were downloaded for free from results obtained from google search. Since I was facing some issues with using these initially, I had to try multiple meshes, and I do not have the link to the mesh I am using right now. But I declare that the tree and bird mesh obj files are not my own work.


# Miscellaneous

<details>
  <summary style="cursor:pointer; font-size: 24px">**Details regarding positioning of trees in the terrain**</summary>
  
  As described above in the report, the condition to be satisfied while placing the trees was that they should be placed randomly. For that I needed a discontinuous random function, by which I mean that the value of the function at `(x, y)` is independent of the value function at the neighouring points. Cryptographic hash functions satisfy this property. But the issue is that we are passing the *global coordinates* of the point as input to the function. Since the global coordinates have been calculated by subtracting the viewer position (`mouse_offset`) from the coordinates of the point in mesh, due to precision limitations of javascript, the global coordinates obtained are not always exactly the same. What I mean by this is that if a point has a global coordinate `(0.5, 0.5)`, when the terrain is moved slightly, its coordinates may become `(0.499999, 0.4999999)`. Since the hash functions are not resistant to this, the value of hash changes and if there existed a tree at `(0.5, 0.5)` before, it may not exist now at `(0.499999, 0.4999999)`. 

  To fix this, I observed that we need to convert the mesh points in the range `(-0.5, 0.5)` into their original range `(0, GRID_SIZE-1)`. So basically I use the inverse of the function `terrain_build_mesh` in `mesh.js` to map the global coordinates of a point in the terrain to an integer, to make it resistant to floating point precision errors. 

  The following code demonstrates this

  ```js
export function get_positions(thresh, terrain_mesh, scale_base=1/20, birds=false){
    ...
    for(let i = 0; i < terrain_mesh.vertex_positions.length; i++){
        let terrain_point = terrain_mesh.vertex_positions[i];
        let x = terrain_point[0] -   MouseCoordinates.mouse_offset_X/2
        let y = terrain_point[1] -   MouseCoordinates.mouse_offset_Y/2

        // in this step, we cannot simply use Math.round(x * 100)
        // or some other function as that gives the floating point precision
        // error as described above
        x = Math.round((x + MIN_TERRAIN_VAL) * GRID_HEIGHT)
        y = Math.round((y + MIN_TERRAIN_VAL) * GRID_WIDTH)

        var hash = CryptoJS.SHA256(x.toString() + y.toString());
        // hash is a hex string, need to convert it to an integer
        // we use .slice(6) to take only 6 characters of the hash for a faster
        // conversion to int
        // modulo 2047 is done to bring the number to a reasonable range
        var hash_num = parseInt(hash.toString(CryptoJS.enc.Hex).slice(6), 16) % 2047;

        ...
    }
    ...   
}
  ```
  
</details>