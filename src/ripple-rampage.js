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
  Mountain_Shader,
} from "./custom-shaders.js";
import { Square, Lake_Mesh, Maze_Walls, Maze_Tiles, Circle, Text_Line } from "./custom-shapes.js";
import { Walk_Movement } from "./movement.js";
import { Shape_From_File } from "../examples/obj-file-demo.js";
import { check_scene_intersection, make_maze, pretty_print_grid, get_square_face, prettify_hour, range, get_farthest, pick_random } from "./utilities.js";
import { lerp, ease_out, strip_rotation, get_spherical_coords, clamp, calculate_sun_position, get_3x3_determinant, wobbly_circle } from "./math-extended.js";
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

function make_7x7_maze(props) {
  props.grid = make_maze(
    props.tiles.x,
    props.tiles.z,
    props.cutout
  );
  pretty_print_grid(props.grid);
}

export class Ripple_Rampage extends Scene {
  constructor() {
    // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
    super();

    this.cam_loc = vec3(0, 0, 0);

    this.maze_props = {
      grid: null,
      length: 60,
      tiles: {
        x: 7,
        z: 7,
      },
      cutout: 3
    };
    const maze_size = this.maze_props.length;
    this.maze_height_ratio = 1.25;
    make_7x7_maze(this.maze_props);

    // initialized in display, do not use prior
    this.sun_color = null;
    this.ambient_color = null;
    this.click_sph_coords = null;
    this.hour_of_day = 12;
    this.time_speed = 1;
    
    this.flash_light = false;
    this.time_at_click = 0;
    this.clicked_on_frame = 0;

    this.fov = 60;
    this.fov_target = 60;

    this.transfomations = {
      click_at: Mat4.translation(-1000,-1000,-1000),
      maze: Mat4.scale(maze_size, maze_size, maze_size),
      cloud: Mat4.scale(1, 1, 1).times(Mat4.translation(0, 5, 0)),
      well: Mat4.translation(0, 0.3, 0).times(Mat4.scale(1.25, 1, 1.25)),
      lake: Mat4.translation(0, 0.01, 0).times(Mat4.scale(1.2, 1, 1.2)),
    };

    // At the beginning of our program, load one of each of these shape definitions onto the GPU.
    this.shapes = {
      light_src: new defs.Subdivision_Sphere(2),
      cube: new defs.Cube(),
      sphere: new Flat_Sphere(3),
      maze_walls: new Maze_Walls(this.maze_props.grid, this.transfomations.maze, this.maze_height_ratio),
      maze_tiles: new Maze_Tiles(this.maze_props.grid, this.transfomations.maze),
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
      well: new Shape_From_File("objects/well-shoulder.obj"),
      text: new Text_Line(50),
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
        color: hex_color("#a06354"),
        ambient_color: color(0, 0, 0, 1),
      }),
      gouraud: new Material(new Gouraud_Shader(), {
        ambient: 0,
        diffusivity: 1,
        specularity: 0.4,
        color: color(1, 1, 1, 1),
      }),
      mountain: new Material(new Mountain_Shader(),{
        ambient: 0.2,
        diffusivity: 1,
        specularity: 0,
        color: hex_color("#a06354"),
        ambient_color: color(0, 0, 0, 1),
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
        ambient_color: color(0, 0, 0, 1),
        ambient: 0.1,
        diffusivity: 3,
        specularity: 0.8,
        bumpiness: 0.5,
        texture: new Texture(
          "textures/tiled-grass-texture.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        spec_map: new Texture(
          "textures/tiled-grass-spec.jpg",
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
        specularity: 2,
        bumpiness: 1,
        texture: new Texture(
          "textures/color_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        spec_map: new Texture(
          "textures/spec_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
        bump_map: new Texture(
          "textures/normal_map.jpg",
          "LINEAR_MIPMAP_LINEAR"
        ),
      }),
      text_image: new Material(new defs.Textured_Phong(1), {
        ambient: 1, 
        diffusivity: 0,
        specularity: 0,
        texture: new Texture("assets/text.png")
      }),
    };

    this.groups = {
      clickables: [
        // {
        //   id: "identifier",
        //   object: this.shapes.identifier,
        //   model_transform: Mat4,
        //   capturable: boolean, // item follows you around when you click
        //   max_distance: number, // when distance is larger click is denied
        //   success?: boolean, // true when clicked and in range
        // },
        {
          id: "cloud",
          object: this.shapes.cloud,
          model_transform: this.transfomations.cloud,
          capturable: true,
          max_distance: 5,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "maze_walls",
          object: this.shapes.maze_walls,
          model_transform: Mat4.identity(),
          capturable: false,
          max_distance: Infinity,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "maze_tiles",
          object: this.shapes.maze_tiles,
          model_transform: Mat4.identity(),
          capturable: false,
          max_distance: Infinity,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "well",
          object: this.shapes.well,
          model_transform: this.transfomations.well,
          capturable: false,
          max_distance: Infinity,
        },
        {
          // this object is temporary
          // to be replaced by walls
          id: "water_surface",
          object: this.shapes.water_surface,
          model_transform: this.transfomations.lake,
          capturable: false,
          max_distance: Infinity,
        },
      ]
    }

    window.clickables = this.groups.clickables;
    window.transfomations = this.transfomations;

    this.captured_object = null;
    this.on_click = this.on_click.bind(this);
    this.reset_cloud = this.reset_cloud.bind(this);

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
    
    this.lakeTransform = this.transfomations.lake;

    this.resetGame = false;
    this.resetGameTime = 0;
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
    this.make_key_insensitive("Make it rain", ["R"], () => {
      if (
        this.resetGame ||
        this.distance_to_cloud() > this.groups.clickables[0].max_distance + 0.5
      ) {
        // TODO: add a message to the user to get closer to the cloud
        console.log("too far");
        return;
      }
      this.addRainButton = true
    });
    this.new_line();
    this.make_key_insensitive("Toggle flashlight", ["F"], () => this.flash_light = !this.flash_light);
    this.new_line();
    this.make_key_insensitive("Rewind Time", ["Z"], () => {
      this.time_speed = -10;
    }, undefined, () => {
      this.time_speed = 1;
    });
    this.new_line();
    this.make_key_insensitive("Fast Forward Time", ["X"], () => {
      this.time_speed = 10;
    }, undefined, () => {
      this.time_speed = 1;
    });
    this.new_line();
    this.new_line();
    this.live_string(box => {
      box.textContent = "Time: " + prettify_hour(this.hour_of_day)
    });
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
      let waterHeight = this.lakeTransform[1][3];
      this.rippleLoc[i][1][3] = waterHeight;
      this.shapes.water_surface.draw(
        context,
        program_state,
        this.rippleLoc[i],
        this.rippleMaterial
      );  
    }
  }

  cleanRaindrops(time){
    if (this.rainTransform.length === 0){
      return;
    }
    
    let numDrops = this.rainTransform.length;
    let index = 0;
    while (index < numDrops){
      let rainx = this.rainTransform[index][0][3];
      let rainy = this.rainTransform[index][1][3];
      let rainz = this.rainTransform[index][2][3];
      let waterHeight = this.lakeTransform[1][3];
      if ((rainy < waterHeight) && this.shapes.water_surface.isInside(rainx, rainz)){
        this.rainVelocity.splice(index, 1);
        this.rainTransform.splice(index, 1);
        this.addRipple(time, Mat4.translation(rainx, 0, rainz));
        this.lakeTransform[1][3] = this.lakeTransform[1][3] + 0.001;
        index = index-1;
        numDrops = numDrops-1;
      }
      else if (rainy < 0){
        this.rainVelocity.splice(index, 1);
        this.rainTransform.splice(index, 1);
        index = index-1;
        numDrops = numDrops-1;
      }
      index = index+1;
    }
  }

  distance_to_cloud() {
    return Math.hypot(
      this.cam_loc[0] - this.transfomations.cloud[0][3],
      this.cam_loc[1] - this.transfomations.cloud[1][3],
      this.cam_loc[2] - this.transfomations.cloud[2][3],
    );
  }

  addRaindrop(){
    const scale = get_3x3_determinant(this.transfomations.cloud);
    const rand_radius = Math.sqrt(Math.random()) * scale;
    const rand_angle = Math.random() * 2 * Math.PI;
    const x = rand_radius * Math.cos(rand_angle);
    const z = rand_radius * Math.sin(rand_angle);
    const loc = strip_rotation(
      this.transfomations.cloud
    ).times(Mat4.translation(x, 0, z));
    this.rainTransform.push(
      loc.times(
        Mat4.scale(0.01, 0.08, 0.01)
      )
    );
    this.rainVelocity.push(7);
  }

  displayRaindrops(context, program_state, ambient_override = {}){
    for (let i = 0; i < this.rainTransform.length; i++) {
      let dt = program_state.animation_delta_time / 1000;
      this.rainVelocity[i] = this.rainVelocity[i] + 7*9.8 * dt;
      this.rainTransform[i] = this.rainTransform[i].times(Mat4.translation(0, -this.rainVelocity[i]*dt, 0));
      this.shapes.raindrop.draw(
        context,
        program_state,
        this.rainTransform[i],
        this.materials.ambient_phong.override({
          color: color(1, 1, 1, 0.75),
          ...ambient_override
        })
      );  
    }
  }

  on_click({
    event,
    position,
    direction,
  }) {
    this.click_sph_coords = get_spherical_coords(direction, true);

    if (this.captured_object?.success) {
      // let item go
      this.captured_object.success = false;
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

      this.groups.clickables[mesh_index].success = is_capturable && is_in_range;
      this.captured_object = this.groups.clickables[mesh_index];
    }
  }

  reset_cloud() {
    let [x, z] = pick_random(
      get_farthest(
        this.maze_props.grid,
        this.maze_props.tiles.x,
        this.maze_props.tiles.z
      )
    );

    x = this.maze_props.length * ((x + 0.5) / (2 * this.maze_props.tiles.x + 1) - 0.5);
    z = this.maze_props.length * ((z + 0.5) / (2 * this.maze_props.tiles.z + 1) - 0.5);

    this.transfomations.cloud[0][3] = x;
    this.transfomations.cloud[2][3] = z;
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
    
    let model_transform = Mat4.identity();
    
    const CMT = program_state.camera_transform;
    const cam_loc = CMT
      .sub_block([0, 3], [3, 4])
      .flat();
    this.cam_loc = vec3(...cam_loc);
    const cam_lead = Mat4.from([
      [CMT[0][0], 0, CMT[0][2], CMT[0][3]    ],
      [        0, 1,         0, CMT[1][3] + 1],
      [CMT[2][0], 0, CMT[2][2], CMT[2][3]    ],
      [        0, 0,         0,         1],
    ]);

    if (!context.scratchpad.controls) {
      this.add_mouse_controls(context.canvas);
      // Add a movement controls panel to the page:
      this.children.push(
        (context.scratchpad.controls = new Walk_Movement({
          on_click: this.on_click,
          get_fov: () => this.fov,
          get_reset_state: () => this.resetGame,
          maze_props: () => this.maze_props,
        }))
      );
      this.click_sph_coords = get_spherical_coords(program_state.camera_transform, false);
      this.reset_cloud();
    }

    const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
    this.hour_of_day = (this.hour_of_day + this.time_speed * dt * 0.25) % 24;

    if (this.clicked_on_frame) {
      this.time_at_click = t;
    }

    const time_since_click = t - this.time_at_click;
    const {sun_azimuth, sun_zenith} = calculate_sun_position(this.hour_of_day, 0, 1);
    const sun_zenith_clamped = clamp(sun_zenith, 0, Math.PI / 2);
    const light_dir = vec4(
      10 * Math.sin(sun_zenith) * Math.cos(sun_azimuth),
      10 * Math.cos(sun_zenith),
      10 * Math.sin(sun_zenith) * Math.sin(sun_azimuth),
      0
    );
    this.ambient_color = get_average_sky_color({
      sun_azimuth,
      sun_zenith,
    });
    this.sun_color = get_sun_color({
      sun_azimuth,
      sun_zenith,
    });
    this.ambient_color.forEach((n, i, a) => {a[i] = n ? n : 0;});
    this.sun_color.forEach((n, i, a) => {a[i] = n ? n : 0;});

    const flash_light_intensity = color(0,0,0,1);
    if (this.flash_light) {
      const intensity = 0.2 + 0.8 * Math.pow(2 * sun_zenith_clamped / Math.PI, 3);
      flash_light_intensity[0] = intensity;
      flash_light_intensity[1] = intensity;
      flash_light_intensity[2] = intensity;
    }

    this.fov = lerp(this.fov, this.fov_target, 0.1);
    program_state.projection_transform = Mat4.perspective(
      Math.PI * this.fov / 180,
      context.width / context.height,
      0.1,
      2400
    );

    const flash_lead = cam_lead.times(vec4(0, 0, -1, 1));
    this.shapes.water_surface.setScale(this.lakeTransform);
    
    // The parameters of the Light are: position, color, size
    program_state.lights = [
      new Light(light_dir, this.sun_color, 50),
      new Light(vec4(...flash_lead, 1), flash_light_intensity, 3),
    ];

    // =========================================================
    // Drawing environment elements (distant)
    // Be careful of the order

    // TODO: prevent distortion when looking up or down
    if (this.captured_object?.success && this.captured_object.capturable) {
      const new_transform = strip_rotation(cam_lead
        .times(Mat4.translation(0, 3, -3))
        .map((x, i) => Vector.from(
          this.captured_object.model_transform[i]).mix(x, 0.1)
        ));
        this.captured_object.model_transform.forEach((x, i, a) => a[i] = new_transform[i]);
    } else if (this.clicked_on_frame && this.captured_object.id === "cloud") {
      // TODO: add a message to the user to get closer to the cloud
      console.log("too far");
    }

    // the following box ignores the depth buffer
    GL.disable(GL.DEPTH_TEST);
    this.shapes.skybox.draw(
      context,
      program_state,
      Mat4.translation(cam_loc[0], cam_loc[1], cam_loc[2]),
      this.materials.skybox.override({
        sun_azimuth,
        sun_zenith,
      })
    );
    GL.enable(GL.DEPTH_TEST);

    const shared_overrides = {
      ambient_color: this.ambient_color,
      ambient: 0.3 + 0.1 * Math.pow(2 * sun_zenith / Math.PI, 2)
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
    
    this.shapes.maze_tiles.draw(
      context,
      program_state,
      Mat4.identity(),
      this.materials.grass_mat.override({
        ...shared_overrides
      })
    );
    
    GL.disable(GL.DEPTH_TEST);
    if (this.addRippleButton){
      this.addRipple(t, Mat4.translation(0, 0, 0));
      this.addRippleButton = false;
    }
    this.displayRipples(context, program_state)
    this.cleanRipples(t);
    GL.enable(GL.DEPTH_TEST);
    
    const mountain_range_small = [
      1, 2, 1, 1, 2, 1, 2, 2, 1
    ].map(x => this.shapes.mountains[x]);

    mountain_range_small.forEach((mountain, i, arr) => {
      const alpha = i / arr.length;
      const radius = 1800;
      const size = 500;
      const [x, z] = wobbly_circle(alpha, 0.2);
      const transform = Mat4.translation(
        radius * x, size * 0.1, radius * z
      );
      transform.post_multiply(Mat4.scale(size, 2*size, size));
      mountain.draw(
        context,
        program_state,
        transform,
        this.materials.mountain.override({
          ...shared_overrides,
          snow_threshold: 750,
        })
      );
    });

    [-0.06, 0.16, 0.5].forEach((alpha) => {
      const radius = 800;
      const size = 275;
      const [x, z] = wobbly_circle(alpha, 0.2);
      const transform = Mat4.translation(
        radius * x, size * 0.2, radius * z
      );
      transform.post_multiply(Mat4.scale(size, size, size));
      this.shapes.mountains[0].draw(
        context,
        program_state,
        transform,
        this.materials.mountain.override({
          ...shared_overrides,
          snow_threshold: 370,
        })
      );
    });

    this.shapes.cloud.draw(
      context,
      program_state,
      this.groups.clickables[0].model_transform,
      this.materials.cloud.override({
        ...shared_overrides
      })
    );

    this.shapes.well.draw(
      context,
      program_state,
      this.transfomations.well,
      this.materials.stone_mat
    );

    this.shapes.maze_walls.draw(
      context,
      program_state,
      Mat4.identity(),
      this.materials.stone_mat.override({
        ...shared_overrides
      })
    );
    
    if (this.addRainButton){
      this.addRaindrop();
      this.addRainButton = false;
    }
    this.displayRaindrops(context, program_state, shared_overrides)
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

    //end of game logic
    if (!this.resetGame){
      if (this.lakeTransform[1][3] > 0.4){
        this.resetGameTime = t;
        this.resetGame = true;
      }
    }
    else if (t < this.resetGameTime + 10.0){
      //logic for locking player position
      this.lakeTransform[1][3] = 0.4 - 0.39 * (t-this.resetGameTime) / 10.0;
      this.shapes.text.set_string('GAME OVER, Please Stand Still as the Maze Resets', context.context);
      this.shapes.text.draw(
        context,
        program_state,
        model_transform.times(Mat4.translation(-6.5, 1, -8)).times(Mat4.scale(0.2, 0.5, 0.5)),
        this.materials.text_image
      );
      this.shapes.text.draw(
        context,
        program_state,
        model_transform.times(Mat4.translation(6.5, 1, 8)).times(Mat4.scale(0.2, 0.5, 0.5)).times(Mat4.rotation(1*3.14, 0, 1, 0)),
        this.materials.text_image
      );
      this.shapes.text.draw(
        context,
        program_state,
        model_transform.times(Mat4.translation(8, 1, -6.5)).times(Mat4.scale(0.5, 0.5, 0.2)).times(Mat4.rotation(-0.5*3.14, 0, 1, 0)),
        this.materials.text_image
      );
      this.shapes.text.draw(
        context,
        program_state,
        model_transform.times(Mat4.translation(-8, 1, 6.5)).times(Mat4.scale(0.5, 0.5, 0.2)).times(Mat4.rotation(0.5*3.14, 0, 1, 0)),
        this.materials.text_image
      );
    }
    else{
      make_7x7_maze(this.maze_props);
      console.log("resetting maze");
      this.shapes.maze_walls.generate(this.maze_props.grid, this.transfomations.maze, this.maze_height_ratio);
      this.shapes.maze_walls.refresh(GL);
      this.shapes.maze_tiles.generate(this.maze_props.grid, this.transfomations.maze, this.maze_height_ratio);
      this.shapes.maze_tiles.refresh(GL);
      this.resetGame = false;
      //reset maze, respawn cloud, unlock player position
    }

    this.reset_cloud();
    this.clicked_on_frame = false;
  }
}
