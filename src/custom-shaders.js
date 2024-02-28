import { defs, tiny } from "../examples/common.js";
import {
  get_shared_skybox_model,
  get_vertex_skybox_model,
  get_fragment_skybox_model,
} from "./hosek-wilkie-shader-strings.js";

const { vec4, color, Shader, Matrix } = tiny;

export class Gouraud_Shader extends Shader {
  // This is a Shader using Phong_Shader as template
  // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

  constructor(num_lights = 2) {
    super();
    this.num_lights = num_lights;
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return ` 
      precision mediump float;
      const int N_LIGHTS = ${this.num_lights};
      uniform float ambient, diffusivity, specularity, smoothness;
      uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
      uniform float light_attenuation_factors[N_LIGHTS];
      uniform vec4 shape_color;
      uniform vec3 squared_scale, camera_center;

      // Specifier "varying" means a variable's final value will be passed from the vertex shader
      // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
      // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).

      varying vec3 vertex_color;
                                         
      vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
        // phong_model_lights():  Add up the lights' contributions.
        vec3 E = normalize( camera_center - vertex_worldspace );
        vec3 result = vec3( 0.0 );
        for(int i = 0; i < N_LIGHTS; i++){
          // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
          // light will appear directional (uniform direction from all points), and we 
          // simply obtain a vector towards the light by directly using the stored value.
          // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
          // the point light's location from the current surface point.  In either case, 
          // fade (attenuate) the light as the vector needed to reach it gets longer.  
          vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                          light_positions_or_vectors[i].w * vertex_worldspace;                                             
          float distance_to_light = length( surface_to_light_vector );

          vec3 L = normalize( surface_to_light_vector );
          vec3 H = normalize( L + E );
          // Compute the diffuse and specular components from the Phong
          // Reflection Model, using Blinn's "halfway vector" method:
          float diffuse  =      max( dot( N, L ), 0.0 );
          float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
          float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
          
          vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                    + light_colors[i].xyz * specularity * specular;
          result += attenuation * light_contribution;
        }
        return result;
      }`;
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position, normal;                            
      // Position is expressed in object coordinates.
      
      uniform mat4 model_transform;
      uniform mat4 projection_camera_model_transform;

      void main(){                     
        vec3 N, vertex_worldspace;                                              
        // The vertex's final resting place (in NDCS):
        gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
        // The final normal vector in screen space.
        N = normalize( mat3( model_transform ) * normal / squared_scale);
        vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
        vertex_color = phong_model_lights( normalize( N ), vertex_worldspace );
      } `;
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // A fragment is a pixel that's overlapped by the current triangle.
    // Fragments affect the final image or get discarded due to depth.
    return `
      ${this.shared_glsl_code()}

      void main(){                                                           
        // Compute an initial (ambient) color:
        gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
        // Compute the final color with contributions from lights:
        gl_FragColor.xyz += vertex_color;
      } `;
  }

  send_material(gl, gpu, material) {
    // send_material(): Send the desired shape-wide material qualities to the
    // graphics card, where they will tweak the Phong lighting formula.
    gl.uniform4fv(gpu.shape_color, material.color);
    gl.uniform1f(gpu.ambient, material.ambient);
    gl.uniform1f(gpu.diffusivity, material.diffusivity);
    gl.uniform1f(gpu.specularity, material.specularity);
    gl.uniform1f(gpu.smoothness, material.smoothness);
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    // send_gpu_state():  Send the state of our whole drawing context to the GPU.
    const O = vec4(0, 0, 0, 1),
      camera_center = gpu_state.camera_transform.times(O).to3();
    gl.uniform3fv(gpu.camera_center, camera_center);
    // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
    const squared_scale = model_transform
      .reduce((acc, r) => {
        return acc.plus(vec4(...r).times_pairwise(r));
      }, vec4(0, 0, 0, 0))
      .to3();
    gl.uniform3fv(gpu.squared_scale, squared_scale);
    // Send the current matrices to the shader.  Go ahead and pre-compute
    // the products we'll need of the of the three special matrices and just
    // cache and send those.  They will be the same throughout this draw
    // call, and thus across each instance of the vertex shader.
    // Transpose them since the GPU expects matrices as column-major arrays.
    const PCM = gpu_state.projection_transform
      .times(gpu_state.camera_inverse)
      .times(model_transform);
    gl.uniformMatrix4fv(
      gpu.model_transform,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.projection_camera_model_transform,
      false,
      Matrix.flatten_2D_to_1D(PCM.transposed())
    );

    // Omitting lights will show only the material color, scaled by the ambient term:
    if (!gpu_state.lights.length) return;

    const light_positions_flattened = [],
      light_colors_flattened = [];
    for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
      light_positions_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].position[i % 4]
      );
      light_colors_flattened.push(
        gpu_state.lights[Math.floor(i / 4)].color[i % 4]
      );
    }
    gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
    gl.uniform4fv(gpu.light_colors, light_colors_flattened);
    gl.uniform1fv(
      gpu.light_attenuation_factors,
      gpu_state.lights.map((l) => l.attenuation)
    );
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
    // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
    // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
    // program (which we call the "Program_State").  Send both a material and a program state to the shaders
    // within this function, one data field at a time, to fully initialize the shader for a draw.

    // Fill in any missing fields in the Material object with custom defaults for this shader:
    const defaults = {
      color: color(0, 0, 0, 1),
      ambient: 0,
      diffusivity: 1,
      specularity: 1,
      smoothness: 40,
    };
    material = Object.assign({}, defaults, material);

    this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}

export class UV_Shader extends Shader {
  // This is a Shader using Phong_Shader as template
  // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

  constructor(num_lights = 2) {
    super();
  }

  shared_glsl_code() {
    // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
    return ` 
      precision mediump float;

      varying vec3 vViewPosition;
      varying vec3 uvs;

      float mapRange(float value, float minValue, float maxValue, float newMinValue, float newMaxValue) {
        return mix(newMinValue, newMaxValue, (value - minValue) / (maxValue - minValue));
      }
    `;
  }

  vertex_glsl_code() {
    // ********* VERTEX SHADER *********
    return `
      ${this.shared_glsl_code()}
      attribute vec3 position, normal;
      
      uniform mat4 projection;
      uniform mat4 view;
      uniform mat4 model;

      void main() {
        uvs.x = mapRange(normal.x,-1.0,1.0,0.0,1.0);
        uvs.y = mapRange(normal.y,-1.0,1.0,0.0,1.0);
        uvs.z = mapRange(normal.z,0.0,-1.0,0.5,1.0);
        // uvs = normal;
        vec4 p4 = vec4(position, 1.0);
        //determine view space p4
        mat4 modelViewMatrix = view * model;
        vec4 viewModelPosition = modelViewMatrix * p4;
        
        //pass varyings to fragment shader
        vViewPosition = viewModelPosition.xyz;
      
        //determine final 3D position
        gl_Position = projection * viewModelPosition;
      }
    `;
  }

  fragment_glsl_code() {
    // ********* FRAGMENT SHADER *********
    // A fragment is a pixel that's overlapped by the current triangle.
    // Fragments affect the final image or get discarded due to depth.
    return `
      ${this.shared_glsl_code()}
      
      void main() {
        gl_FragColor = vec4(uvs, 1.0);
      }
    `;
  }

  send_material(gl, gpu, material) {
    // nothing to do
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    gl.uniformMatrix4fv(
      gpu.projection,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.projection_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.view,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.camera_inverse.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.model,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    const defaults = {
      color: color(0, 0, 0, 1),
    };
    material = Object.assign({}, defaults, material);

    // this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}

export class Hosek_Wilkie_Skybox extends Shader {
  constructor() {
    super();
  }

  shared_glsl_code() {
    return get_shared_skybox_model();
  }

  vertex_glsl_code() {
    return (
      this.shared_glsl_code() +
      get_vertex_skybox_model()
    );
  }

  fragment_glsl_code() {
    return (
      this.shared_glsl_code() +
      get_fragment_skybox_model()
    );
  }

  send_material(gl, gpu, material) {
    // here I can pass turbidity and other props and maybe time
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    gl.uniformMatrix4fv(
      gpu.projection,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.projection_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.view,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.camera_inverse.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.model,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed())
    );
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    const defaults = {
      color: color(0, 0, 0, 1),
    };
    material = Object.assign({}, defaults, material);
    context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);

    // this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}

export class Crosshair_Shader extends Shader {
  constructor() {
    super();
  }

  shared_glsl_code() {
    return `
      precision mediump float;
      // varying vec2 uv;
    `;
  }

  vertex_glsl_code() {
    return `
      ${this.shared_glsl_code()}

      attribute vec2 texture_coord;
      attribute vec3 position;

      void main() {
        // uv = texture_coord;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
  }

  fragment_glsl_code() {
    return `
      ${this.shared_glsl_code()}

      uniform vec2 resolution;

      float cross_hair(vec2 pos, float thickness, float length) {
        float ratio_yx = resolution.y / resolution.x;
        float stroke_width = thickness / resolution.x;
        float radius = stroke_width * 0.5;
        vec2 pos2 = abs(pos - 0.5);
        float length_ratio = thickness / length;
        return min(
          max(
            pos2.x,
            length_ratio * ratio_yx * pos2.y
          ) - radius,
          max(
            length_ratio * pos2.x,
            ratio_yx * pos2.y
          ) - radius
        );
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5) / resolution;
        // float ratio = resolution.x / resolution.y;
        // float thickness = 0.08; // Adjust the thickness of the crosshair lines
        // float length = 0.1; // Adjust the length of the crosshair lines
    
        // // Horizontal line
        // float horzLine = step(uv.y, 0.5 + thickness * 0.5) - step(uv.y, 0.5 - thickness * 0.5);
        // // Vertical line
        // float vertLine = step(uv.x, 0.5 + thickness * 0.5) - step(uv.x, 0.5 - thickness * 0.5);
    
        // // Apply length adjustment to the lines
        // horzLine *= step(uv.x, 0.5 + length * 0.5) * step(0.5 - length * 0.5, uv.x);
        // vertLine *= step(uv.y, 0.5 + length * 0.5) * step(0.5 - length * 0.5, uv.y);
    
        // // Combine the lines
        // vec3 color = vec3(1.0); // Set crosshair color to white
        // vec3 crosshair = mix(color, vec3(0.0), horzLine * vertLine);
        
        // gl_FragColor = vec4(vec2(uv.xy),0.0,1.0  );
        // gl_FragColor = vec4(crosshair, 1.0);
        float cross_threshold = cross_hair(uv, 2.0, 10.0);
        if (cross_hair(uv, 2.0, 20.0) <= 0.0) {
          gl_FragColor = vec4(vec3(1.0), 0.75);
        } else if (cross_hair(uv, 4.0, 22.0) <= 0.0) {
          gl_FragColor = vec4(vec3(0.0), 0.75);
        } else {
          discard;
        }
      }
    `;
  }

  send_material(gl, gpu, material) {
    // nothing to do
  }

  send_gpu_state(gl, gpu, gpu_state, model_transform) {
    gl.uniformMatrix4fv(
      gpu.projection,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.projection_transform.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.view,
      false,
      Matrix.flatten_2D_to_1D(gpu_state.camera_inverse.transposed())
    );
    gl.uniformMatrix4fv(
      gpu.model,
      false,
      Matrix.flatten_2D_to_1D(model_transform.transposed()));
  }

  update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
    const defaults = {
      color: color(0, 0, 0, 1),
    };
    material = Object.assign({}, defaults, material);
    context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
    context.uniform2fv(gpu_addresses.resolution, [context.canvas.width, context.canvas.height]);

    // this.send_material(context, gpu_addresses, material);
    this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
  }
}
