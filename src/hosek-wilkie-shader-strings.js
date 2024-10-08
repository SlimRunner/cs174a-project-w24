/*
I have adapted the code for this shader from a shadertoy
https://www.shadertoy.com/view/wslfD7

The changes include the conversion from the original coordinate system
and the implementation of a vertex shader since Shadertoy provides
always just a single fullscreen fragment.

Additionally, I fix a bug the code had that it naively computed a arccos
of 1 and -1.
*/

export function get_shared_skybox_model() {
return(`#version 300 es

precision highp float;

/*
This source is published under the following 3-clause BSD license.

Copyright (c) 2012 - 2013, Lukas Hosek and Alexander Wilkie
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * None of the names of the contributors may be used to endorse or promote
      products derived from this software without specific prior written
      permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const float kHosekCoeffsX[] = float[](
-1.171419,
-0.242975,
-8.991334,
9.571216,
-0.027729,
0.668826,
0.076835,
3.785611,
0.634764,
-1.228554,
-0.291756,
2.753986,
-2.491780,
-0.046634,
0.311830,
0.075465,
4.463096,
0.595507,
-1.093124,
-0.244777,
0.909741,
0.544830,
-0.295782,
2.024167,
-0.000515,
-1.069081,
0.936956,
-1.056994,
0.015695,
-0.821749,
1.870818,
0.706193,
-1.483928,
0.597821,
6.864902,
0.367333,
-1.054871,
-0.275813,
2.712807,
-5.950110,
-6.554039,
2.447523,
-0.189517,
-1.454292,
0.913174,
-1.100218,
-0.174624,
1.438505,
11.154810,
-3.266076,
-0.883736,
0.197010,
1.991595,
0.590782
);

const float kHosekCoeffsY[] = float[](
-1.185983,
-0.258118,
-7.761056,
8.317053,
-0.033518,
0.667667,
0.059417,
3.820727,
0.632403,
-1.268591,
-0.339807,
2.348503,
-2.023779,
-0.053685,
0.108328,
0.084029,
3.910254,
0.557748,
-1.071353,
-0.199246,
0.787839,
0.197470,
-0.303306,
2.335298,
-0.082053,
0.795445,
0.997231,
-1.089513,
-0.031044,
-0.599575,
2.330281,
0.658194,
-1.821467,
0.667997,
5.090195,
0.312516,
-1.040214,
-0.257093,
2.660489,
-6.506045,
-7.053586,
2.763153,
-0.243363,
-0.764818,
0.945294,
-1.116052,
-0.183199,
1.457694,
11.636080,
-3.216426,
-1.045594,
0.228500,
1.817407,
0.581040
);

const float kHosekCoeffsZ[] = float[](
-1.354183,
-0.513062,
-42.192680,
42.717720,
-0.005365,
0.413674,
0.012352,
2.520122,
0.518727,
-1.741434,
-0.958976,
-8.230339,
9.296799,
-0.009600,
0.499497,
0.029555,
0.366710,
0.352700,
-0.691735,
0.215489,
-0.876026,
0.233412,
-0.019096,
0.474803,
-0.113851,
6.515360,
1.225097,
-1.293189,
-0.421870,
1.620952,
-0.785860,
-0.037694,
0.663679,
0.336494,
-0.534102,
0.212835,
-0.973552,
-0.132549,
1.007517,
0.259826,
0.067622,
0.001421,
-0.069160,
3.185897,
0.864196,
-1.094800,
-0.196206,
0.575559,
0.290626,
0.262575,
0.764405,
0.134749,
2.677126,
0.646546
);

const float kHosekRadX[] = float[](
1.468395,
2.211970,
-2.845869,
20.750270,
15.248220,
19.376220
);

const float kHosekRadY[] = float[](
1.516536,
2.438729,
-3.624121,
22.986210,
15.997820,
20.700270
);

const float kHosekRadZ[] = float[](
1.234428,
2.289628,
-3.404699,
14.994360,
34.683900,
30.848420
);
`);
}

export function get_vertex_skybox_model() {
return (`
out vec3 frag_pos;

in vec3 position, normal;
out vec3 fragCoord;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

void main() {
  vec4 p4 = vec4(position, 1.0);
  //determine view space p4
  mat4 modelViewMatrix = view * model;
  vec4 viewModelPosition = modelViewMatrix * p4;

  //pass varyings to fragment shader
  fragCoord = position;

  //determine final 3D position
  gl_Position = projection * viewModelPosition;
}
`);
}

export function get_fragment_skybox_model() {
return (`
// Implementation of 2012 Hosek-Wilkie skylight model

// Ground albedo and turbidity are baked into the lookup tables
#define ALBEDO 1
#define TURBIDITY 3

#define M_PI 3.1415926535897932384626433832795
#define H_PI 1.5707963267948966192313216916398
#define CIE_X 0
#define CIE_Y 1
#define CIE_Z 2

float sample_coeff(int channel, int albedo, int turbidity, int quintic_coeff, int coeff) {
  // int index = 540 * albedo + 54 * turbidity + 9 * quintic_coeff + coeff;
  int index =  9 * quintic_coeff + coeff;
  if (channel == CIE_X) return kHosekCoeffsX[index];
  if (channel == CIE_Y) return kHosekCoeffsY[index];
  if (channel == CIE_Z) return kHosekCoeffsZ[index];
}

float sample_radiance(int channel, int albedo, int turbidity, int quintic_coeff) {
  // int index = 60 * albedo + 6 * turbidity + quintic_coeff;
  int index = quintic_coeff;
  if (channel == CIE_X) return kHosekRadX[index];
  if (channel == CIE_Y) return kHosekRadY[index];
  if (channel == CIE_Z) return kHosekRadZ[index];
}

float eval_quintic_bezier(in float[6] control_points, float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  float t4 = t3 * t;
  float t5 = t4 * t;
  
  float t_inv = 1.0 - t;
  float t_inv2 = t_inv * t_inv;
  float t_inv3 = t_inv2 * t_inv;
  float t_inv4 = t_inv3 * t_inv;
  float t_inv5 = t_inv4 * t_inv;

  return (
    control_points[0] *             t_inv5 +
    control_points[1] *  5.0 * t  * t_inv4 +
    control_points[2] * 10.0 * t2 * t_inv3 +
    control_points[3] * 10.0 * t3 * t_inv2 +
    control_points[4] *  5.0 * t4 * t_inv  +
    control_points[5] *        t5
  );
}

float transform_sun_zenith(float sun_zenith) {
  float elevation = H_PI - sun_zenith;
  return pow(elevation / (H_PI), 0.333333);
}

void get_control_points(int channel, int albedo, int turbidity, int coeff, out float[6] control_points) {
  for (int i = 0; i < 6; ++i) control_points[i] = sample_coeff(channel, albedo, turbidity, i, coeff);
}

void get_control_points_radiance(int channel, int albedo, int turbidity, out float[6] control_points) {
  for (int i = 0; i < 6; ++i) control_points[i] = sample_radiance(channel, albedo, turbidity, i);
}

void get_coeffs(int channel, int albedo, int turbidity, float sun_zenith, out float[9] coeffs) {
  float t = transform_sun_zenith(sun_zenith);
  for (int i = 0; i < 9; ++i) {
    float control_points[6];
    get_control_points(channel, albedo, turbidity, i, control_points);
    coeffs[i] = eval_quintic_bezier(control_points, t);
  }
}

vec3 mean_spectral_radiance(int albedo, int turbidity, float sun_zenith) {
  vec3 spectral_radiance;
  for (int i = 0; i < 3; ++i) {
    float control_points[6];
    get_control_points_radiance(i, albedo, turbidity, control_points);
    float t = transform_sun_zenith(sun_zenith);
    spectral_radiance[i] = eval_quintic_bezier(control_points, t);
  }
  return spectral_radiance;
}

float F(float theta, float gamma, in float[9] coeffs) {
  float A = coeffs[0];
  float B = coeffs[1];
  float C = coeffs[2];
  float D = coeffs[3];
  float E = coeffs[4];
  float F = coeffs[5];
  float G = coeffs[6];
  float H = coeffs[8];
  float I = coeffs[7];
  float chi = (1.0 + pow(cos(gamma), 2.0)) / pow(1.0 + H*H - 2.0 * H * cos(gamma), 1.5);
  
  return (
    (1.0 + A * exp(B / (cos(theta) + 0.01))) *
    (C + D * exp(E * gamma) + F * pow(cos(gamma), 2.0) + G * chi + I * sqrt(cos(theta)))
  );
}

vec3 spectral_radiance(float theta, float gamma, int albedo, int turbidity, float sun_zenith) {
  vec3 XYZ;
  for (int i = 0; i < 3; ++i) {
    float coeffs[9];
    get_coeffs(i, albedo, turbidity, sun_zenith, coeffs);
    XYZ[i] = F(theta, gamma, coeffs);
  }
  return XYZ;
}

// Returns angle between two directions defined by zentih and azimuth angles
float angle(float z1, float a1, float z2, float a2) {
  float dist = sin(z1) * cos(a1) * sin(z2) * cos(a2) +
    sin(z1) * sin(a1) * sin(z2) * sin(a2) +
    cos(z1) * cos(z2);
  dist = clamp(dist, 0.0, 1.0);
  return acos(dist);
}

vec3 sample_sky(float view_zenith, float view_azimuth, float sun_zenith, float sun_azimuth) {
  float gamma = angle(view_zenith, view_azimuth, sun_zenith, sun_azimuth);
  float theta = view_zenith;
  return spectral_radiance(theta, gamma, ALBEDO, TURBIDITY, sun_zenith) * mean_spectral_radiance(ALBEDO, TURBIDITY, sun_zenith);
}

// CIE-XYZ to linear RGB
vec3 XYZ_to_RGB(vec3 XYZ) {
  mat3 XYZ_to_linear = mat3(
     3.24096994, -0.96924364, 0.55630080,
    -1.53738318,  1.8759675, -0.20397696,
    -0.49861076,  0.04155506, 1.05697151
  );
  return XYZ_to_linear * XYZ;
}

// Clamps color between 0 and 1 smoothly
vec3 tonemap(vec3 color, float exposure) {
  return vec3(2.0) / (vec3(1.0) + exp(-exposure * color)) - vec3(1.0);
}

in vec3 fragCoord;
out vec4 fragColor;

uniform vec2 sun_dir;

void main() {
  // how I computed the azimuth and zenith since it differs from how it was used in the source
  // https://www.desmos.com/3d/1551f3941d
  // nice way to calculate spherical coordinates
  // https://gamedev.stackexchange.com/a/87307

  // high noon at 0, horizon at pi/2
  float sun_zenith = sun_dir.x;
  float sun_zenith_safe = clamp(sun_zenith, 0.0, H_PI);
  // starts at x-axis moves clockwise towards z at pi/2
  float sun_azimuth = sun_dir.y;
  
  // same as sun zenith but for the sky
  float view_zenith = atan(length(fragCoord.xz), max(0.0, fragCoord.y));
  // same as sun azimuth but for the sky
  float view_azimuth = atan(fragCoord.z, fragCoord.x);
  // float view_azimuth = sign(fragCoord.z) * acos(fragCoord.x / length(fragCoord.xz));

  // compute color using hosek-wilkie model in XYZ color space
  vec3 XYZ = sample_sky(view_zenith, view_azimuth, sun_zenith_safe, sun_azimuth);
  // transform back to RGB
  vec3 RGB = XYZ_to_RGB(XYZ);
  // adjust brightness gain
  vec3 col = tonemap(RGB, 0.1);

  if (sun_zenith > H_PI) {
    float alpha = 1.0 / (10.0 * (sun_zenith - H_PI) + 1.0);
    col = col * alpha;
  }

  // assign final color
  fragColor = clamp(vec4(col, 1.0), 0.0, 1.0);
}
`);
}