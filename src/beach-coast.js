import { defs, tiny } from "../examples/common.js";
import { Phong_Shader_2, Gouraud_Shader, UV_Shader, Hosek_Wilkie_Skybox, Crosshair_Shader, Ripple_Shader } from "./custom-shaders.js";
import { Square } from "./custom-shapes.js";
import { Walk_Movement } from "./movement.js";
import { Shape_From_File } from "../examples/obj-file-demo.js";
import { draw_if_ready } from "./utilities.js";

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
      cube: new defs.Cube(),
      sphere: new Flat_Sphere(3),
      floor: new Square(),
      water_surface: new Square(),
      skybox: new defs.Cube(),
      gui_box: new defs.Square(),
      mountains: [
        new Shape_From_File("objects/mountain.obj"),
        new Shape_From_File("objects/01-mountain.obj"),
        new Shape_From_File("objects/02-mountain.obj"),
      ],
    };

    // *** Materials
    this.materials = {
      // standard has max specularity and diffuse, zero  ambient
      phong: new Material(new defs.Phong_Shader(), {ambient: 0, diffusivity: 1, specularity: 0,color: color(1, 1, 1, 1)}),
      phong2: new Material(new Phong_Shader_2(), {ambient: 0.6, diffusivity: 1, specularity: 0,color: color(1, 1, 1, 1), ambient_color: hex_color("#d8e8ff")}),
      gouraud: new Material(new Gouraud_Shader(), {ambient: 0, diffusivity: 1, specularity: 0.4,color: color(1, 1, 1, 1)}),
      uv: new Material(new UV_Shader()),
      matte: new Material(new defs.Phong_Shader(), {ambient: 0, diffusivity: 1, specularity: 0, color: color(1, 1, 1, 1)}),
      skybox: new Material(new Hosek_Wilkie_Skybox()),
      ui_crosshair: new Material(new Crosshair_Shader()),
      ripple: new Material(new Ripple_Shader(), {color: hex_color("#ADD8E6"), size: 2.0, period: 10.0, birth: 0.0}),
    };

    this.initial_camera_location = Mat4.look_at(
      vec3(0, 10, 20),
      vec3(0, 0, 0),
      vec3(0, 1, 0)
    );

    this.addRippleButton = false;
    this.ripplesBirth = [];
    this.rippleShaders = [];
  }

  make_control_panel() {
    // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
    // this.key_triggered_button(
    //   "Button Label",
    //   ["Meta", "key"],
    //   callback
    // );
    this.key_triggered_button("Add Ripple", ["Shift", "R"], () => this.addRippleButton = true);
    this.new_line();
  }

  cleanRipples(time){
    if (this.ripplesBirth.length === 0){
      return;
    }
    let notClean = true;
    while (notClean && this.ripplesBirth.length > 0){
      if ((this.ripplesBirth[0] + 3.0) < time){
        this.ripplesBirth.shift();
        this.rippleShaders.shift();
      }
      else{
        notClean = false;
      }
    }
  }

  addRipple(time){
    this.ripplesBirth.push(time);
    this.rippleShaders.push(new Material(new Ripple_Shader(), {color: hex_color("#ADD8E6"), size: 2.0, period: 10.0, birth: time}));
    console.log(this.ripplesBirth);
  }

  displayRipples(context, program_state){
    for (let i = 0; i < this.rippleShaders.length; i++) {
      let model_transform = Mat4.translation(0, 0.02, 0).times(Mat4.scale(4, 1, 4));
      this.shapes.water_surface.draw(
        context,
        program_state,
        model_transform,
        this.rippleShaders[i]
      );  
    }
  }
  
  display(context, program_state) {
    // display():  Called once per frame of animation.
    // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:

    /*
    context has the following properties:
    context.context: WebGLRenderingContext
    context.canvas: HTMLCanvasElement
    context.width: number
    context.height: number
    context.time: number
    context.program_state: camera, and animation properties
    context.scratchpad: {controls: Walk_Movement}
    context.scenes: {beach_coast: Beach_Coast}
    */

    // this makes clear what I am calling
    const GL = context.context;

    if (!context.scratchpad.controls) {
      // Add a movement controls panel to the page:
      this.children.push(
        (context.scratchpad.controls = new Walk_Movement())
      );
      // context.canvas.style.cursor = "none";
    }

    const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

    program_state.projection_transform = Mat4.perspective(
      Math.PI * 64 / 180,
      context.width / context.height,
      0.1,
      1000
    );

    let model_transform = Mat4.identity();

    const ripple_transform = Mat4.translation(0, 0.01, 0).times(Mat4.scale(8, 1, 8));

    // The parameters of the Light are: position, color, size
    program_state.lights = [
      new Light(vec4(-5, 300, -5, 1), color(1,1,1,1), 10000),
      new Light(vec4(5, 6, 5, 1), color(1,1,1,1), 20),
    ];

    // =========================================================
    // Drawing environment elements (distant)
    // Be careful of the order
  
    const cam_loc = program_state
      .camera_transform
      .sub_block([0, 3], [3, 4])
      .flat();

    // the following box ignores the depth buffer
    GL.disable(GL.DEPTH_TEST);
    this.shapes.skybox.draw(
      context,
      program_state,
      Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.skybox
    );
    GL.enable(GL.DEPTH_TEST);
    
    // =========================================================
    // Main scene is rendered here
    
    this.shapes.mountains[0].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(120, 10, 120)).times(Mat4.scale(50, 50, 50)),
      this.materials.phong2
    );
    this.shapes.mountains[1].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(-3,0,9)).times(Mat4.scale(6, 8, 6)),
      this.materials.phong.override(color(0.6, 0.4, 0.35, 1.0))
    );
    this.shapes.mountains[2].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(3,0,8)).times(Mat4.scale(6, 8, 6)),
      this.materials.phong.override(color(0.6, 0.4, 0.35, 1.0))
    );

    this.shapes.sphere.draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(0, 3, 0)),
      this.materials.uv
    );

    this.shapes.floor.draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(0, 0, 0)).times(Mat4.scale(100, 1, 100)),
      this.materials.phong2
    );
    
    this.shapes.water_surface.draw(
      context,
      program_state,
      ripple_transform,
      this.materials.phong.override(hex_color("#00FFFF"))
    );

    if (this.addRippleButton){
      this.addRipple(t);
      this.addRippleButton = false;
    }
    this.displayRipples(context, program_state)
    this.cleanRipples(t);
    
    // =========================================================
    // Below this line only GUI elements must be rendered.
    
    this.shapes.gui_box.draw(
      context,
      program_state,
      model_transform.times(Mat4.scale(10, 1, 10)),
      this.materials.ui_crosshair
    );
  }
}
