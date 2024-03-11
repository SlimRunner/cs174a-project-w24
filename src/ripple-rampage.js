import { defs, tiny } from "../examples/common.js";
import {
  Phong_Shader_2,
  Gouraud_Shader,
  UV_Shader,
  Hosek_Wilkie_Skybox,
  Crosshair_Shader,
  Ripple_Shader,
  Complex_Textured,
  Flat_Color_Shader,
  Cloud_Shader,
} from "./custom-shaders.js";
import { Square, Lake_Mesh, Maze_Walls, Maze_Tiles } from "./custom-shapes.js";
import { Walk_Movement } from "./movement.js";
import { Shape_From_File } from "../examples/obj-file-demo.js";
import { check_scene_intersection, make_maze, pretty_print_grid, get_square_face } from "./utilities.js";
import { lerp, ease_out, strip_rotation, get_spherical_coords } from "./math-extended.js";
import { get_average_sky_color, get_sun_color } from "./hosek-wilkie-color.js";

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

    const maze_size = 60;
    const maze_height_ratio = 1.25;
    this.maze = make_maze(7, 7, 3);

    // initialized in display, do not use prior
    this.sun_color = null;
    this.ambient_color = null;
    this.click_sph_coords = null;
    
    this.flash_light = false;
    this.time_at_click = 0;
    this.clicked_on_frame = 0;
    
    pretty_print_grid(this.maze);

    this.fov = 60;
    this.fov_target = 60;

    this.transfomations = {
      click_at: Mat4.translation(-1000,-1000,-1000),
      maze: Mat4.scale(maze_size, maze_size, maze_size),
    }

    // At the beginning of our program, load one of each of these shape definitions onto the GPU.
    this.shapes = {
      light_src: new defs.Subdivision_Sphere(2),
      cube: new defs.Cube(),
      sphere: new Flat_Sphere(3),
      maze_walls: new Maze_Walls(this.maze, this.transfomations.maze, maze_height_ratio),
      maze_tiles: new Maze_Tiles(this.maze, this.transfomations.maze),
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

    // *** Materials
    this.materials = {
      // standard has max specularity and diffuse, zero  ambient
      solid_white: new Material(new Flat_Color_Shader(), {color: color(1, 1, 1, 1)}),
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
        ambient: 0.3,
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
      cloud: new Material(new Cloud_Shader(), {
        ambient: 0,
        diffusivity: 1,
        specularity: 0.4,
        color: hex_color("#000000")
      }),
      uv: new Material(new UV_Shader()),
      skybox: new Material(new Hosek_Wilkie_Skybox()),
      ui_crosshair: new Material(new Crosshair_Shader(), {
        fg_color: color(1, 1, 1, 0.4),
        bg_color: color(0, 0, 0, 0.8),
      }),
      ripple: new Material(new Ripple_Shader(), {
        color: hex_color("#ADD8E6"),
        size: 2.0,
        period: 10.0,
        birth: 0.0,
      }),
      grass_mat: new Material(new Complex_Textured(), {
        color: color(0, 0, 0, 1),
        ambient: 0.1,
        diffusivity: 4,
        specularity: 1,
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
        ambient: 0.4,
        diffusivity: 4,
        specularity: 3,
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
        // {
        //   id: "identifier",
        //   object: this.shapes.identifier,
        //   model_transform: Mat4,
        //   capturable: boolean, // item follows you around when you click
        //   interactive: boolean, // something happens when you click
        //   max_distance: number, // when distance is larger click is denied
        // },
        {
          id: "cloud",
          object: this.shapes.cloud,
          model_transform: Mat4.scale(1, 1, 1).times(Mat4.translation(0, 3, 0)),
          capturable: true,
          interactive: false,
          max_distance: 15,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "maze_walls",
          object: this.shapes.maze_walls,
          model_transform: Mat4.identity(),
          capturable: false,
          interactive: false,
          max_distance: Infinity,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "maze_tiles",
          object: this.shapes.maze_tiles,
          model_transform: Mat4.identity(),
          capturable: false,
          interactive: true,
          max_distance: Infinity,
        },
      ]
    }

    this.captured_object = null;
    this.on_click = this.on_click.bind(this);

    this.initial_camera_location = Mat4.look_at(
      vec3(0, 10, 20),
      vec3(0, 0, 0),
      vec3(0, 1, 0)
    );

    this.addRippleButton = false;
    this.ripplesBirth = [];
    this.rippleLoc = [];
    this.rippleShader = new Ripple_Shader();
    this.rippleMaterial = new Material(this.rippleShader, {color: hex_color("#ADD8E6"), size: 2.0, period: 10.0});
    
    this.addRainButton = false;
    this.rainVelocity = [];
    this.rainTransform = [];

    
    this.lakeTransform = Mat4.translation(0, 0.01, 0).times(Mat4.scale(1, 1, 1));
  }

  add_mouse_controls(canvas) {
    const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
    canvas.addEventListener(wheelEvent, (event) => {
      event.preventDefault();
      this.fov_target = Math.min(
        70, Math.max(20, this.fov_target + (event.deltaY < 0 ? -1 : 1) * 10)
      );
      return false;
    });
  }

  make_key_insensitive(
    description,
    shortcut_combination,
    callback,
    color = "#6E6460",
    release_event,
    recipient = this,
    parent = this.control_panel
  ) {
    this.key_triggered_button(
      description,
      shortcut_combination.map((s) => s.length > 1? s: s.toUpperCase()),
      callback,
      color,
      release_event,
      recipient,
      parent
    );
    this.key_triggered_button(
      description,
      shortcut_combination.map((s) => s.length > 1? s: s.toLowerCase()),
      callback,
      color,
      release_event,
      recipient,
      parent
    );
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
    this.make_key_insensitive("Toggle flashlight", ["F"], () => this.flash_light = !this.flash_light);
    this.new_line();
    this.live_string(
      (box) => {
        box.textContent = "sun color: " + Array.from(this.sun_color??[]).map(n => n.toFixed(2));
        box.style.backgroundColor = `rgb(${this?.sun_color?.map((n,i) => (i===3?n:n*255)).join(',')})`;
      }
    );
  }

  cleanRipples(time){
    if (this.ripplesBirth.length === 0){
      return;
    }
    let notClean = true;
    while (notClean && this.ripplesBirth.length > 0){
      if ((this.ripplesBirth[0] + 3.0) < time){
        this.ripplesBirth.shift();
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
  }

  displayRipples(context, program_state){
    for (let i = 0; i < this.ripplesBirth.length; i++) {
      this.rippleShader.setBirth(this.ripplesBirth[i]);
      this.shapes.water_surface.draw(
        context,
        program_state,
        this.rippleLoc[i],
        // this.materials.uv
        this.rippleMaterial
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
    this.rainTransform.push(loc.times(Mat4.scale(0.01, 0.08, 0.01)));
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
    event,
    position,
    direction,
  }) {
    this.click_sph_coords = get_spherical_coords(direction, true);

    if (this.captured_object) {
      // let item go
      this.captured_object = null;
      return;
    }

    const {
      point: intersection,
      mesh_index: mesh_index,
      distance: distance
    } = check_scene_intersection(position, direction, this.groups.clickables);
    
    if (intersection) {
      this.transfomations.click_at[0][3] = intersection[0];
      this.transfomations.click_at[1][3] = intersection[1];
      this.transfomations.click_at[2][3] = intersection[2];
      this.clicked_on_frame = true;

      const is_capturable = this.groups.clickables[mesh_index].capturable;
      const is_in_range = distance <= (
        this.groups.clickables[mesh_index].max_distance ??
        Infinity
      );

      if (is_capturable && is_in_range) {
        this.captured_object = this.groups.clickables[mesh_index];
      }
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
    context.scenes: {ripple_Rampage: Ripple_Rampage}
    */

    // this makes clear what I am calling
    const GL = context.context;

    if (!context.scratchpad.controls) {
      this.add_mouse_controls(context.canvas);
      // Add a movement controls panel to the page:
      this.children.push(
        (context.scratchpad.controls = new Walk_Movement({
          on_click: this.on_click,
          get_fov: () => this.fov
        }))
      );
      this.click_sph_coords = get_spherical_coords(program_state.camera_transform, false);
    }

    const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

    if (this.clicked_on_frame) {
      this.clicked_on_frame = false;
      this.time_at_click = t;
    }

    const time_since_click = t - this.time_at_click;
    const sun_azimuth = this.click_sph_coords.theta;
    const sun_zenith = Math.min(this.click_sph_coords.phi, Math.PI / 2);
    const light_dir = vec4(
      10 * Math.sin(sun_zenith) * Math.cos(sun_azimuth),
      10 * Math.cos(sun_zenith),
      10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
      0
    );
    this.ambient_color = get_average_sky_color({
      // sun_zenith: Math.PI * 0.50 * (0.5 * Math.sin(0.2 * t) + 0.5),
      // sun_azimuth: Math.PI * ((0.2 * t) % 2.0),
      sun_azimuth,
      sun_zenith,
    });
    this.sun_color = get_sun_color({
      sun_azimuth,
      sun_zenith,
    });

    this.fov = lerp(this.fov, this.fov_target, 0.1);
    program_state.projection_transform = Mat4.perspective(
      Math.PI * this.fov / 180,
      context.width / context.height,
      0.1,
      1000
    );

    let model_transform = Mat4.identity();
    
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
    const flash_lead = cam_lead.times(vec4(0, 0, -1, 1));

    this.shapes.water_surface.setScale(this.lakeTransform);
    // The parameters of the Light are: position, color, size
    this.click_at
    program_state.lights = [
      new Light(light_dir, this.sun_color, 50),
      new Light(vec4(...flash_lead, 1), (this.flash_light?color(1,1,1,1):color(0,0,0,1)), 3),
    ];

    // =========================================================
    // Drawing environment elements (distant)
    // Be careful of the order

    // TODO: prevent distortion when looking up or down
    if (this.captured_object && this.captured_object.capturable) {
      this.captured_object.model_transform = strip_rotation(cam_lead
        .times(Mat4.translation(0, 0, -3))
        .map((x, i) => Vector.from(
          this.captured_object.model_transform[i]).mix(x, 0.1)
        ));
    }

    // the following box ignores the depth buffer
    GL.disable(GL.DEPTH_TEST);
    this.shapes.skybox.draw(
      context,
      program_state,
      Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.skybox.override({
        sun_azimuth: this.click_sph_coords.theta,
        sun_zenith: Math.min(this.click_sph_coords.phi, Math.PI / 2),
      })
    );
    GL.enable(GL.DEPTH_TEST);

    const shared_overrides = {
      color: this.ambient_color,
      // ambient: 0.1 + 0.3 * Math.atan(Math.min(Math.PI / 2, this.click_sph_coords.phi))
      ambient: 0.1 + 0.3 * Math.pow(2 * this.click_sph_coords.phi / Math.PI, 2)
    };
    
    // =========================================================
    // Main scene is rendered here
    
    this.shapes.water_surface.draw(
      context,
      program_state,
      this.lakeTransform,
      // this.materials.matte.override(this.ambient_color)
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
    
    this.shapes.mountains[0].draw(
      context,
      program_state,
      model_transform.times(Mat4.translation(120, 10, 120)).times(Mat4.scale(50, 50, 50)),
      this.materials.ambient_phong.override({color: color(0.6, 0.4, 0.35, 1.0), diffusivity: 5})
    );
    // this.shapes.mountains[1].draw(
    //   context,
    //   program_state,
    //   model_transform.times(Mat4.translation(-3,0,9)).times(Mat4.scale(6, 8, 6)),
    //   this.materials.matte.override(color(0.6, 0.4, 0.35, 1.0))
    // );
    // this.shapes.mountains[2].draw(
    //   context,
    //   program_state,
    //   model_transform.times(Mat4.translation(3,0,8)).times(Mat4.scale(6, 8, 6)),
    //   this.materials.matte.override(color(0.6, 0.4, 0.35, 1.0))
    // );

    this.shapes.cloud.draw(
      context,
      program_state,
      this.groups.clickables[0].model_transform,
      this.materials.cloud
    );

    this.shapes.maze_walls.draw(
      context,
      program_state,
      Mat4.identity(),
      this.materials.stone_mat.override({
        ...shared_overrides
      })
    );
    this.shapes.maze_tiles.draw(
      context,
      program_state,
      Mat4.identity(),
      this.materials.grass_mat.override({
        ...shared_overrides
      })
    );
    
    if (this.addRainButton){
      this.addRaindrop(strip_rotation(this.groups.clickables[0].model_transform));
      this.addRainButton = false;
    }
    this.displayRaindrops(context, program_state)
    this.cleanRaindrops(t);

    if (time_since_click < 0.5) {
      const t_smooth = ease_out(time_since_click * 2);
      const sp_size = lerp(0, 0.25, t_smooth);
      // how to place something where you clicked
      this.shapes.sphere.draw(
        context,
        program_state,
        this.transfomations.click_at.times(Mat4.scale(sp_size ,sp_size ,sp_size)),
        this.materials.solid_white.override({
          color: color(1, 1, 1, lerp(1, 0, t_smooth))
        })
      );
    }
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
