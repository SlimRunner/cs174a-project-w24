import { defs, tiny } from "../examples/common.js";
import { Gouraud_Shader, UV_Shader, Ripple_Shader} from "./custom-shaders.js";
import { Square } from "./custom-shapes.js";

const {
  Vector,
  Vector3,
  vec,
  vec3,
  vec4,
  color,
  hex_color,
  Shader,
  Matrix,
  Mat4,
  Light,
  Shape,
  Material,
  Scene,
} = tiny;

const Flat_Sphere = defs.Subdivision_Sphere.prototype.make_flat_shaded_version();

export class Beach_Coast extends Scene {
  constructor() {
    // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
    super();

    // At the beginning of our program, load one of each of these shape definitions onto the GPU.
    this.shapes = {
      square: new Square(),
      cube: new defs.Cube(),
      sphere: new Flat_Sphere(3)
    };

    // *** Materials
    this.materials = {
      // standard has max specularity and diffuse, zero  ambient
      phong: new Material(new defs.Phong_Shader(), {ambient: 0, diffusivity: 1, specularity: 0,color: color(1,1,1,1)}),
      gouraud: new Material(new Gouraud_Shader(), {ambient: 0, diffusivity: 1, specularity: 0,color: color(1,1,1,1)}),
      uv: new Material(new UV_Shader()),
      ripple: new Material(new Ripple_Shader(), {color: hex_color("#B08040"), size: 2.0, period: 10.0}),
    };

    this.initial_camera_location = Mat4.look_at(
      vec3(0, 10, 20),
      vec3(0, 0, 0),
      vec3(0, 1, 0)
    );
  }

  make_control_panel() {
    // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
    // this.key_triggered_button(
    //   "Button Label",
    //   ["Meta", "key"],
    //   callback
    // );
  }

  display(context, program_state) {
    // display():  Called once per frame of animation.
    // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
    if (!context.scratchpad.controls) {
      this.children.push(
        (context.scratchpad.controls = new defs.Movement_Controls())
      );
      // Define the global camera and projection matrices, which are stored in program_state.
      program_state.set_camera(this.initial_camera_location);
    }

    program_state.projection_transform = Mat4.perspective(
      Math.PI * 32 / 180,
      context.width / context.height,
      0.1,
      1000
    );

    const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

    // The parameters of the Light are: position, color, size
    program_state.lights = [
      new Light(vec4(-2, 2, -2, 1), color(1,1,1,1), 100),
      new Light(vec4(2, -2, 2, 1), color(1,1,1,1), 100),
    ];

    let model_transform = Mat4.scale(4, 1, 4);
    this.shapes.square.draw(
      context,
      program_state,
      model_transform,
      this.materials.ripple
    );
  }
}
