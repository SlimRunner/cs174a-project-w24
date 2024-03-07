import { defs, tiny } from "../examples/common.js";
import {
  Phong_Shader_2,
  Gouraud_Shader,
  UV_Shader,
  Hosek_Wilkie_Skybox,
  Crosshair_Shader,
  Ripple_Shader,
  Complex_Textured,
} from "./custom-shaders.js";
import { Square, Lake_Mesh } from "./custom-shapes.js";
import { Walk_Movement } from "./movement.js";
import { Shape_From_File } from "../examples/obj-file-demo.js";
import { ray_triangle_intersection } from "./utilities.js";

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
  Texture,
} = tiny;

const Flat_Sphere = defs.Subdivision_Sphere.prototype.make_flat_shaded_version();

export class Ripple_Rampage extends Scene {
  constructor() {
    // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
    super();

    this.transfomations = {
      cloud_mat: Mat4.scale(1, 1, 1).times(Mat4.translation(0, 3, 0)),
      large_floor_mat: Mat4.translation(0, 0, 0).times(Mat4.scale(100, 1, 100)),
      large_dome: Mat4.translation(20, 30, 15).times(Mat4.scale(20, 20, 20)),
      click_at: Mat4.identity()
    }

    // At the beginning of our program, load one of each of these shape definitions onto the GPU.
    this.shapes = {
      cube: new defs.Cube(),
      sphere: new Flat_Sphere(3),
      large_floor: new Square(),
      small_square: new Square(),
      water_surface: new Lake_Mesh(),
      raindrop: new defs.Subdivision_Sphere(4),
      skybox: new defs.Cube(),
      gui_box: new defs.Square(),
      mountains: [
        new Shape_From_File("objects/mountain.obj"),
        new Shape_From_File("objects/01-mountain.obj"),
        new Shape_From_File("objects/02-mountain.obj"),
      ],
      cloud: new Shape_From_File("objects/cloud-simple.obj"),
    };
    this.shapes.large_floor.arrays.texture_coord.forEach((v, i, a) => (a[i] = v.times(40)));
    this.shapes.small_square.arrays.texture_coord.forEach((v, i, a) => (a[i] = v.times(4)));

    // *** Materials
    this.materials = {
      // standard has max specularity and diffuse, zero  ambient
      matte: new Material(new defs.Phong_Shader(), {
        ambient: 0,
        diffusivity: 1,
        specularity: 0,
        color: color(1, 1, 1, 1),
      }),
      plastic: new Material(new defs.Phong_Shader(), {
        ambient: 0,
        diffusivity: 2,
        specularity: 3,
        color: color(1, 1, 1, 1),
      }),
      ambient_phong: new Material(new Phong_Shader_2(), {
        ambient: 0.6,
        diffusivity: 1,
        specularity: 0,
        color: color(1, 1, 1, 1),
        ambient_color: hex_color("#d8e8ff"),
      }),
      gouraud: new Material(new Gouraud_Shader(), {
        ambient: 0,
        diffusivity: 1,
        specularity: 0.4,
        color: color(1, 1, 1, 1),
      }),
      uv: new Material(new UV_Shader()),
      matte: new Material(new defs.Phong_Shader(), {
        ambient: 0,
        diffusivity: 1,
        specularity: 0,
        color: color(1, 1, 1, 1),
      }),
      skybox: new Material(new Hosek_Wilkie_Skybox()),
      ui_crosshair: new Material(new Crosshair_Shader()),
      ripple: new Material(new Ripple_Shader(), {
        color: hex_color("#ADD8E6"),
        size: 2.0,
        period: 10.0,
        birth: 0.0,
      }),
      grass_mat: new Material(new Complex_Textured(), {
        color: color(0, 0, 0, 1),
        ambient: 0.2,
        diffusivity: 4,
        specularity: 2,
        texture: new Texture(
          "textures/tiled-grass-texture.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        spec_map: new Texture(
          "textures/tiled-grass-texture.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        bump_map: new Texture(
          "textures/tiled-grass-bump.png",
          "LINEAR_MIPMAP_LINEAR"
        ),
      }),
      stone_mat: new Material(new Complex_Textured(), {
        color: color(0, 0, 0, 1),
        ambient: 0.2,
        diffusivity: 4,
        specularity: 6,
        texture: new Texture(
          // "textures/tiled-grass-texture.jpg",
          "textures/color_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        spec_map: new Texture(
          // "textures/tiled-grass-texture.jpg",
          "textures/spec_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        bump_map: new Texture(
          // "textures/tiled-grass-bump.png",
          "textures/normal_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
      }),
    };

    this.groups = {
      clickables: [
        {
          object: this.shapes.cloud,
          model_transform: this.transfomations.cloud_mat
        },
        {
          object: this.shapes.large_floor,
          model_transform: this.transfomations.large_floor_mat
        },
        {
          object: this.shapes.sphere,
          model_transform: this.transfomations.large_dome
        },
      ]
    }

    this.on_click = this.on_click.bind(this);

    this.initial_camera_location = Mat4.look_at(
      vec3(0, 10, 20),
      vec3(0, 0, 0),
      vec3(0, 1, 0)
    );

    this.addRippleButton = false;
    this.ripplesBirth = [];
    this.rippleShaders = [];
    this.rippleLoc = [];
    
    this.addRainButton = false;
    this.rainVelocity = [];
    this.rainTransform = [];

    
    this.lakeTransform = Mat4.translation(0, 0.01, 0).times(Mat4.scale(1, 1, 1));
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
    this.key_triggered_button("Add Raindrop", ["Shift", "W"], () => this.addRainButton = true);
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
        this.rippleLoc.shift();
      }
      else{
        notClean = false;
      }
    }
  }

  addRipple(time, loc){
    this.ripplesBirth.push(time);
    this.rippleLoc.push(loc);
    this.rippleShaders.push(new Material(new Ripple_Shader(), {color: hex_color("#ADD8E6"), size: 2.0, period: 10.0, birth: time}));
  }

  displayRipples(context, program_state){
    for (let i = 0; i < this.rippleShaders.length; i++) {
      this.shapes.water_surface.draw(
        context,
        program_state,
        this.rippleLoc[i],
        this.rippleShaders[i]
      );  
    }
  }

  cleanRaindrops(time){
    if (this.rainTransform.length === 0){
      return;
    }
    let notClean = true;
    while (notClean && this.rainTransform.length > 0){
      let rainx = this.rainTransform[0][0][3];
      let rainy = this.rainTransform[0][1][3];
      let rainz = this.rainTransform[0][2][3];
      if (rainy < 0.0){
        this.rainVelocity.shift();
        this.rainTransform.shift();
        let insideShape = this.shapes.water_surface.isInside(rainx, rainz);
        if(insideShape){
          this.addRipple(time, Mat4.translation(rainx, 0, rainz));
          this.lakeTransform[0][0] = this.lakeTransform[0][0] + 0.01;
          this.lakeTransform[2][2] = this.lakeTransform[2][2] + 0.01;
        }
      }
      else{
        notClean = false;
      }
    }
  }

  addRaindrop(loc){
    this.rainTransform.push(loc.times(Mat4.translation(0, 2, 0).times(Mat4.scale(0.01, 0.08, 0.01))));
    this.rainVelocity.push(7);
  }

  displayRaindrops(context, program_state){
    for (let i = 0; i < this.rainTransform.length; i++) {
      let dt = program_state.animation_delta_time / 1000;
      this.rainVelocity[i] = this.rainVelocity[i] + 7*9.8 * dt;
      this.rainTransform[i] = this.rainTransform[i].times(Mat4.translation(0, -this.rainVelocity[i]*dt, 0));
      this.shapes.raindrop.draw(
        context,
        program_state,
        this.rainTransform[i],
        this.materials.ambient_phong.override(hex_color("#FFFFFF"))
      );  
    }
  }

  on_click({
    position,
    direction
  }) {
    const GP = this.groups;
    let inter_point = null, new_point = null;
    let inter_dist = Infinity, new_dist = 0;
    let tpos, arr_alias;

    for (const clickable of GP.clickables) {
      for (let i = 0; i < clickable.object.indices.length; i += 3) {
        arr_alias = clickable.object.arrays;
        tpos = [
          clickable.model_transform.times(vec4(...arr_alias.position[clickable.object.indices[i]], 1)),
          clickable.model_transform.times(vec4(...arr_alias.position[clickable.object.indices[i + 1]], 1)),
          clickable.model_transform.times(vec4(...arr_alias.position[clickable.object.indices[i + 2]], 1)),
        ]
        new_point = ray_triangle_intersection(
          position, direction,
          tpos[0],
          tpos[1],
          tpos[2]
        );
        if (new_point) {
          new_dist = new_point.minus(position).norm();
          if (new_dist < inter_dist) {
            inter_point = new_point;
            inter_dist = new_dist;
          }
        }
      }
    }
    if (inter_point) {
      this.transfomations.click_at[0][3] = inter_point[0];
      this.transfomations.click_at[1][3] = inter_point[1];
      this.transfomations.click_at[2][3] = inter_point[2];
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
    context.scenes: {ripple_Overdrive: Ripple_Overdrive}
    */

    // this makes clear what I am calling
    const GL = context.context;

    if (!context.scratchpad.controls) {
      // Add a movement controls panel to the page:
      this.children.push(
        (context.scratchpad.controls = new Walk_Movement({
          on_click: this.on_click
        }))
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

    this.shapes.water_surface.setScale(this.lakeTransform);
    // The parameters of the Light are: position, color, size
    program_state.lights = [
      new Light(vec4(-5, 300, -5, 1), color(1,1,1,1), 10000),
      new Light(vec4(5, 6, 5, 1), color(1,1,1,1), 20),
    ];

    // =========================================================
    // Drawing environment elements (distant)
    // Be careful of the order
    
    const CMT = program_state.camera_transform;
    const cam_loc = CMT
      .sub_block([0, 3], [3, 4])
      .flat();
    const cam_lead = Mat4.from([
      [CMT[0][0], 0, CMT[0][2], CMT[0][3]    ],
      [        0, 1,         0, CMT[1][3] + 1],
      [CMT[2][0], 0, CMT[2][2], CMT[2][3]    ],
      [        0, 0,         0,         1],
    ]);

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
      this.materials.ambient_phong
    );
    this.shapes.mountains[1].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(-3,0,9)).times(Mat4.scale(6, 8, 6)),
      this.materials.matte.override(color(0.6, 0.4, 0.35, 1.0))
    );
    this.shapes.mountains[2].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(3,0,8)).times(Mat4.scale(6, 8, 6)),
      this.materials.matte.override(color(0.6, 0.4, 0.35, 1.0))
    );

    this.shapes.cloud.draw(
      context,
      program_state,
      // cam_lead.times(Mat4.translation(0, 0, -3)),
      this.transfomations.cloud_mat,
      this.materials.uv
    );

    this.shapes.large_floor.draw(
      context,
      program_state,
      // model_transform.times(Mat4.translation(0, 0, 0)).times(Mat4.scale(100, 1, 100)),
      this.transfomations.large_floor_mat,
      this.materials.grass_mat
    );

    this.shapes.small_square.draw(
      context,
      program_state,
      model_transform
        .times(Mat4.translation(18, 0.01, 0))
        .times(Mat4.scale(-8, 0.01, 8))
        ,
      this.materials.stone_mat
    );

    this.shapes.sphere.draw(
      context,
      program_state,
      this.transfomations.click_at.times(Mat4.scale(0.25,0.25,0.25)),
      this.materials.matte
    )
    
    this.shapes.sphere.draw(
      context,
      program_state,
      this.transfomations.large_dome,
      this.materials.uv
    )
    
    this.shapes.water_surface.draw(
      context,
      program_state,
      this.lakeTransform,
      this.materials.matte.override(hex_color("#00FFFF"))
    );
    
    GL.disable(GL.DEPTH_TEST);
    if (this.addRippleButton){
      this.addRipple(t, Mat4.translation(0, 0, 1));
      this.addRippleButton = false;
    }
    this.displayRipples(context, program_state)
    this.cleanRipples(t);
    GL.enable(GL.DEPTH_TEST);
    
    if (this.addRainButton){
      this.addRaindrop(Mat4.translation(0, 0, 0));
      this.addRainButton = false;
    }
    this.displayRaindrops(context, program_state)
    this.cleanRaindrops(t);    
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
