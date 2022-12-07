/* @license add your license lines here, these will be used by webpack.*/

// these are the variables you can use as inputs to your algorithms
console.log(fxhash); // the 64 chars hex number fed to your algorithm
console.log(fxrand()); // deterministic PRNG function, use it instead of Math.random()

// note about the fxrand() function
// when the "fxhash" is always the same, it will generate the same sequence of
// pseudo random numbers, always

//----------------------
// defining features
//----------------------
// You can define some token features by populating the $fxhashFeatures property
// of the window object.
// More about it in the guide, section features:
// [https://fxhash.xyz/articles/guide-mint-generative-token#features]
//
// window.$fxhashFeatures = {
//   "Background": "Black",
//   "Number of lines": 10,
//   "Inverted": true
// }

const vs = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

void main () {
  gl_Position = a_position;

  v_texcoord = a_texcoord;
}
`;

const fs = `#version 300 es
  precision highp float;

  in vec2 v_texcoord;

  uniform sampler2D u_texture;

  out vec4 outColor;

  void main () {
    outColor = texture(u_texture, v_texcoord);
  }
`;

const vsForTex = `#version 300 es
in vec2 a_position;
in vec4 a_color;

out vec4 v_color;

uniform mat3 u_matrix;
uniform vec2 u_resolution;

void main() {
  float aspect = u_resolution.y / u_resolution.x;
  if (aspect < 1.0) {
    gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy * aspect, 0, 1);
  } else {
    gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy / aspect, 0, 1);
  }
  v_color = a_color;
}
`;

const fsForTex = `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

import p5 from "p5";
import * as twgl from "twgl.js";
import * as earcut from "earcut";

const sketch = (p) => {
  let gl;
  let texture;
  let framebuffer;
  let textureWidth;
  let textureHeight;

  const width = 1000;
  const height = 1000;

  let programInfo;
  let programTexInfo;

  p.setup = function () {
    gl = document
      .querySelector("#canvas")
      .getContext("webgl2", { alpha: false, preserveDrawingBuffer: true });

    if (!gl) {
      console.error("WebGL2 not loaded");
      p.draw = function () {};
      return;
    }

    gl.getExtension("OES_texture_float_linear");
    gl.getExtension("EXT_float_blend");
    gl.getExtension("EXT_color_buffer_float");

    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );

    twgl.setAttributePrefix("a_");
    programInfo = twgl.createProgramInfo(gl, [vs, fs]);
    programTexInfo = twgl.createProgramInfo(gl, [vsForTex, fsForTex]);

    p.randomSeed(fxrand() * 1000000);
    p.noiseSeed(fxrand() * 1000000);
    p.createCanvas(0, 0);

    createTexture(gl);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clearColor(0.4, 0.4, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  p.draw = function () {
    let dx = 40 * 1.05 ** p.frameCount;
    let alpha = 0.1 * 1.02 ** p.frameCount;

    let polygons = [
      {
        vertices: [
          [200 + dx, 300],
          [230 + dx, 300],
          [290 + dx, 400],
          [200 + dx, 400],
        ],
      },
    ];

    let [triangles, colors] = generateTriangles(polygons, [1, 0, 0, alpha]);

    plotTriangles(triangles, colors);

    if (p.frameCount > 50) {
      p.noLoop();
    }
  };

  function getTriangles(polygon) {
    let verts = earcut(polygon.flat());
    return verts.map((idx) => polygon[idx]).flat();
  }

  function generateTriangles(polygons, color) {
    let triangles = [];
    let colors = [];

    for (let ii = 0; ii < polygons.length; ii++) {
      let polygon = polygons[ii];
      let verts = getTriangles(polygon.vertices);

      let localColors = Array(verts.length / 2)
        .fill(color)
        .flat();

      triangles = triangles.concat(verts);
      colors = colors.concat(localColors);
    }

    return [triangles, colors];
  }

  function plotTriangles(vertices, colors) {
    let triangleArr = {
      position: {
        numComponents: 2,
        data: vertices,
      },
      color: {
        numComponents: 4,
        data: colors,
      },
    };

    const texUniforms = {
      u_matrix: [2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1],
      u_resolution: [width, height],
    };

    let bufferInfo = twgl.createBufferInfoFromArrays(gl, triangleArr);

    let vao = twgl.createVAOFromBufferInfo(gl, programTexInfo, bufferInfo);
    gl.bindVertexArray(vao);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, textureWidth, textureHeight);

    gl.useProgram(programTexInfo.program);

    twgl.setUniforms(programTexInfo, texUniforms);

    twgl.drawBufferInfo(gl, bufferInfo);

    let programAttrs = {
      position: {
        numComponents: 2,
        data: [-1, -1, -1, 1, 1, -1, 1, -1, -1, 1, 1, 1],
      },
      texcoord: {
        numComponents: 2,
        data: [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1],
      },
    };

    bufferInfo = twgl.createBufferInfoFromArrays(gl, programAttrs);

    vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    gl.bindVertexArray(vao);

    gl.useProgram(programInfo.program);

    const uniforms = { u_texture: 0 };
    twgl.setUniforms(programInfo, uniforms);

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    twgl.drawBufferInfo(gl, bufferInfo);
  }

  function createTexture(gl) {
    textureWidth = width;
    textureHeight = height;
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);

    var level = 0;
    var internalFormat = gl.RGBA32F;
    var border = 0;
    var format = gl.RGBA;
    let type = gl.FLOAT;
    var data = null;
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      textureWidth,
      textureHeight,
      border,
      format,
      type,
      data
    );

    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    level = 0;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      targetTexture,
      level
    );

    texture = targetTexture;
    framebuffer = fb;
  }
};

new p5(sketch);
