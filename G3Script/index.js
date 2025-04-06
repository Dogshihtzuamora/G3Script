 function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Erro ao compilar shader: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Erro ao linkar o programa: " + gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function createIdentityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function multiplyMatrix(a, b) {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i * 4 + k] * b[k * 4 + j];
      }
      result[i * 4 + j] = sum;
    }
  }
  return result;
}

function multiplyMatrixVector(mat, vec) {
  const result = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    result[i] = mat[i * 4] * vec[0] + mat[i * 4 + 1] * vec[1] + mat[i * 4 + 2] * vec[2] + mat[i * 4 + 3] * vec[3];
  }
  return result;
}

function createPerspectiveMatrix(fov, aspect, near, far) {
  const f = Math.tan(Math.PI * 0.5 - 0.5 * fov);
  const rangeInv = 1.0 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ];
}

function createLookAtMatrix(eyeZ) {
  const z = -eyeZ;
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, z, 1
  ];
}

function createRotationMatrix(xDeg, yDeg, zDeg) {
  const xRad = xDeg * Math.PI / 180;
  const yRad = yDeg * Math.PI / 180;
  const zRad = zDeg * Math.PI / 180;

  const rx = [
    1, 0, 0, 0,
    0, Math.cos(xRad), -Math.sin(xRad), 0,
    0, Math.sin(xRad), Math.cos(xRad), 0,
    0, 0, 0, 1
  ];
  const ry = [
    Math.cos(yRad), 0, Math.sin(yRad), 0,
    0, 1, 0, 0,
    -Math.sin(yRad), 0, Math.cos(yRad), 0,
    0, 0, 0, 1
  ];
  const rz = [
    Math.cos(zRad), -Math.sin(zRad), 0, 0,
    Math.sin(zRad), Math.cos(zRad), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];

  let result = rx;
  result = multiplyMatrix(result, ry);
  result = multiplyMatrix(result, rz);
  return result;
}

function createTranslationMatrix(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ];
}

function createScaleMatrix(sx, sy, sz) {
  return [
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1
  ];
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1.0];
}

function interpretarG3script(script, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("Canvas não encontrado: " + canvasId);
    return;
  }
  
  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.error("WebGL não é suportado no canvas: " + canvasId);
    return;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  const vertexShaderSource = `
    attribute vec4 a_position;
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_projectionMatrix;
    void main(void) {
      gl_Position = u_projectionMatrix * u_modelViewMatrix * a_position;
    }
  `;
  const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main(void) {
      gl_FragColor = u_color;
    }
  `;

  const shaderProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  gl.useProgram(shaderProgram);

  const vertices = [];
  const faces = [];
  let currentColor = [1.0, 1.0, 1.0, 1.0];
  let transformationMatrix = createIdentityMatrix();

  const linhas = script.split('\n');
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();

    if (linha.startsWith('V ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const x = parseFloat(parts[1].replace(',', ''));
      const y = parseFloat(parts[2].replace(',', ''));
      const z = parseFloat(parts[3].replace(',', ''));

      const vertex = [x, y, z, 1];
      const transformedVertex = multiplyMatrixVector(transformationMatrix, vertex);
      vertices.push(transformedVertex[0], transformedVertex[1], transformedVertex[2]);
    }

    if (linha.startsWith('C ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const r = parseFloat(parts[1].replace(',', ''));
      const g = parseFloat(parts[2].replace(',', ''));
      const b = parseFloat(parts[3].replace(',', ''));
      currentColor = [r, g, b, 1.0];
    }

    if (linha.startsWith('F ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const indices = [];
      let color = currentColor.slice();

      for (let j = 1; j < parts.length && !parts[j].includes('C='); j++) {
        indices.push(parseInt(parts[j].replace(',', '')));
      }

      const colorPart = linha.split('C=');
      if (colorPart.length > 1) {
        const colorValue = colorPart[1].trim();
        if (colorValue.startsWith('#')) {
          color = hexToRgb(colorValue);
        } else {
          const [r, g, b] = colorValue.split(',').map(v => parseFloat(v.trim().replace(',', '')));
          color = [r, g, b, 1.0];
        }
      }

      faces.push({ indices, color });
    }

    if (linha.startsWith('R ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const x = parseFloat(parts[1].replace(',', ''));
      const y = parseFloat(parts[2].replace(',', ''));
      const z = parseFloat(parts[3].replace(',', ''));
      const rotationMatrix = createRotationMatrix(x, y, z);
      transformationMatrix = multiplyMatrix(transformationMatrix, rotationMatrix);
    }

    if (linha.startsWith('O ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const x = parseFloat(parts[1].replace(',', ''));
      const y = parseFloat(parts[2].replace(',', ''));
      const z = parseFloat(parts[3].replace(',', ''));
      const translationMatrix = createTranslationMatrix(x, y, z);
      transformationMatrix = multiplyMatrix(transformationMatrix, translationMatrix);
    }

    if (linha.startsWith('S ')) {
      const parts = linha.split(' ').filter(p => p !== '');
      const sx = parseFloat(parts[1].replace(',', ''));
      const sy = parseFloat(parts[2].replace(',', ''));
      const sz = parseFloat(parts[3].replace(',', ''));
      const scaleMatrix = createScaleMatrix(sx, sy, sz);
      transformationMatrix = multiplyMatrix(transformationMatrix, scaleMatrix);
    }
  }
  
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLocation);

  const modelViewMatrixLocation = gl.getUniformLocation(shaderProgram, "u_modelViewMatrix");
  const projectionMatrixLocation = gl.getUniformLocation(shaderProgram, "u_projectionMatrix");
  const colorLocation = gl.getUniformLocation(shaderProgram, "u_color");

  const modelViewMatrix = createLookAtMatrix(5.0);
  const projectionMatrix = createPerspectiveMatrix(Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

  gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);
  gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  faces.forEach(face => {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(face.indices), gl.STATIC_DRAW);

    gl.uniform4fv(colorLocation, face.color);
    gl.drawElements(gl.TRIANGLES, face.indices.length, gl.UNSIGNED_SHORT, 0);
  });
    }
