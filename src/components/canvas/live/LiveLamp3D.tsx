"use client";

import { useEffect, useRef } from "react";

/** WebGL 360° 环绕展台：拖动环视，松手后继续慢转 */
export function LiveLamp3D({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(
      vs,
      `attribute vec3 aPos; attribute vec3 aN;
       uniform mat4 uMVP, uM;
       varying vec3 vN; varying vec3 vW;
       void main(){
         vec4 w = uM * vec4(aPos,1.0);
         vW = w.xyz; vN = mat3(uM)*aN;
         gl_Position = uMVP * vec4(aPos,1.0);
       }`,
    );
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(
      fs,
      `precision mediump float;
       varying vec3 vN; varying vec3 vW;
       uniform vec3 uEye, uColA, uColB; uniform float uKind;
       void main(){
         vec3 N = normalize(vN);
         vec3 L1 = normalize(vec3(-0.4, 0.8, 0.5));
         vec3 L2 = normalize(vec3(0.7, 0.2, -0.4));
         vec3 V = normalize(uEye - vW);
         float nd = max(dot(N,L1),0.0);
         float sp = pow(max(dot(reflect(-L1,N),V),0.0), 48.0);
         vec3 base = uColA;
         if (uKind < 0.5) {
           float bands = 0.5 + 0.5*sin(vW.y*9.0 + vW.x*1.4);
           base = mix(uColA, uColB, clamp(vW.y*0.55+0.5,0.0,1.0));
           base = mix(base, vec3(0.95,0.72,0.38), bands*0.22);
         } else if (uKind < 1.5) {
           base = mix(vec3(0.92,0.74,0.42), vec3(0.55,0.38,0.16), abs(N.y));
         } else {
           float wood = 0.5 + 0.5*sin(vW.x*18.0 + vW.z*4.0);
           base = mix(vec3(0.28,0.15,0.08), vec3(0.55,0.32,0.16), wood);
         }
         vec3 col = base * (0.18 + 0.75*nd) + vec3(1.0,0.92,0.75)*sp*0.55;
         col += vec3(0.25,0.45,0.8) * max(dot(N,L2),0.0) * 0.15;
         float fog = smoothstep(6.0, 0.4, length(vW.xz));
         col = mix(vec3(0.03,0.035,0.05), col, 0.55+0.45*fog);
         gl_FragColor = vec4(col,1.0);
       }`,
    );
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, "aPos");
    const aN = gl.getAttribLocation(prog, "aN");
    const uMVP = gl.getUniformLocation(prog, "uMVP");
    const uM = gl.getUniformLocation(prog, "uM");
    const uEye = gl.getUniformLocation(prog, "uEye");
    const uColA = gl.getUniformLocation(prog, "uColA");
    const uColB = gl.getUniformLocation(prog, "uColB");
    const uKind = gl.getUniformLocation(prog, "uKind");

    function meshSphere(r: number, sl: number, st: number) {
      const p: number[] = [];
      const n: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= st; i++) {
        const v = (i / st) * Math.PI;
        for (let j = 0; j <= sl; j++) {
          const u = (j / sl) * Math.PI * 2;
          const x = r * Math.sin(v) * Math.cos(u);
          const y = r * Math.cos(v);
          const z = r * Math.sin(v) * Math.sin(u);
          p.push(x, y, z);
          const l = Math.hypot(x, y, z) || 1;
          n.push(x / l, y / l, z / l);
        }
      }
      for (let i = 0; i < st; i++) {
        for (let j = 0; j < sl; j++) {
          const a = i * (sl + 1) + j;
          const b = a + sl + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      return pack(p, n, idx);
    }
    function meshTorus(R: number, r: number, sl: number, st: number) {
      const p: number[] = [];
      const n: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= st; i++) {
        const v = (i / st) * Math.PI * 2;
        for (let j = 0; j <= sl; j++) {
          const u = (j / sl) * Math.PI * 2;
          const cx = Math.cos(u);
          const cz = Math.sin(u);
          const x = (R + r * Math.cos(v)) * cx;
          const y = r * Math.sin(v) * 0.22;
          const z = (R + r * Math.cos(v)) * cz;
          p.push(x, y, z);
          const nx = Math.cos(v) * cx;
          const ny = Math.sin(v);
          const nz = Math.cos(v) * cz;
          const l = Math.hypot(nx, ny, nz) || 1;
          n.push(nx / l, ny / l, nz / l);
        }
      }
      for (let i = 0; i < st; i++) {
        for (let j = 0; j < sl; j++) {
          const a = i * (sl + 1) + j;
          const b = a + sl + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      return pack(p, n, idx);
    }
    function meshCyl(rt: number, rb: number, h: number, sl: number, y0: number) {
      const p: number[] = [];
      const n: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= 1; i++) {
        const y = y0 + (i ? 0 : -h);
        const rad = i ? rt : rb;
        for (let j = 0; j <= sl; j++) {
          const u = (j / sl) * Math.PI * 2;
          const x = rad * Math.cos(u);
          const z = rad * Math.sin(u);
          p.push(x, y, z);
          n.push(Math.cos(u), 0.15, Math.sin(u));
        }
      }
      for (let j = 0; j < sl; j++) {
        const a = j;
        const b = j + 1;
        const c = sl + 1 + j;
        const d = sl + 2 + j;
        idx.push(a, c, b, b, c, d);
      }
      const cap = p.length / 3;
      p.push(0, y0, 0);
      n.push(0, 1, 0);
      for (let j = 0; j <= sl; j++) {
        const u = (j / sl) * Math.PI * 2;
        p.push(rt * Math.cos(u), y0, rt * Math.sin(u));
        n.push(0, 1, 0);
      }
      for (let j = 0; j < sl; j++) idx.push(cap, cap + 1 + j, cap + 2 + j);
      return pack(p, n, idx);
    }
    function pack(p: number[], n: number[], idx: number[]) {
      return {
        p: new Float32Array(p),
        n: new Float32Array(n),
        i: new Uint16Array(idx),
      };
    }

    const sphere = meshSphere(0.72, 48, 32);
    const ring = meshTorus(1.05, 0.16, 64, 24);
    const base = meshCyl(0.78, 0.82, 0.28, 48, -1.05);
    const brass = meshTorus(0.42, 0.035, 40, 12);

    function buf(data: Float32Array) {
      const b = gl!.createBuffer()!;
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
      return b;
    }
    function ibuf(data: Uint16Array) {
      const b = gl!.createBuffer()!;
      gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ELEMENT_ARRAY_BUFFER, data, gl!.STATIC_DRAW);
      return b;
    }
    const geo = [
      { p: buf(sphere.p), n: buf(sphere.n), i: ibuf(sphere.i), c: sphere.i.length, kind: 0, ya: 0.12 },
      { p: buf(ring.p), n: buf(ring.n), i: ibuf(ring.i), c: ring.i.length, kind: 1, ya: 0.08 },
      { p: buf(base.p), n: buf(base.n), i: ibuf(base.i), c: base.i.length, kind: 2, ya: 0 },
      { p: buf(brass.p), n: buf(brass.n), i: ibuf(brass.i), c: brass.i.length, kind: 1, ya: -0.92 },
    ];

    let yaw = 0.55;
    let pitch = 0.28;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let auto = true;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      auto = false;
      lx = e.clientX;
      ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lx) * 0.008;
      pitch = Math.max(-0.15, Math.min(1.05, pitch + (e.clientY - ly) * 0.006));
      lx = e.clientX;
      ly = e.clientY;
    };
    const onUp = () => {
      dragging = false;
      window.setTimeout(() => {
        auto = true;
      }, 700);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    function mul(a: Float32Array, b: Float32Array) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
          o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    }
    function persp(fov: number, asp: number, near: number, far: number) {
      const f = 1 / Math.tan(fov / 2);
      const m = new Float32Array(16);
      m[0] = f / asp;
      m[5] = f;
      m[10] = (far + near) / (near - far);
      m[11] = -1;
      m[14] = (2 * far * near) / (near - far);
      return m;
    }
    function lookAt(ex: number, ey: number, ez: number, tx: number, ty: number, tz: number) {
      let zx = ex - tx,
        zy = ey - ty,
        zz = ez - tz;
      let zl = Math.hypot(zx, zy, zz) || 1;
      zx /= zl;
      zy /= zl;
      zz /= zl;
      // right = up(0,1,0) × z
      let xx = zz,
        xy = 0,
        xz = -zx;
      let xl = Math.hypot(xx, xy, xz) || 1;
      xx /= xl;
      xy /= xl;
      xz /= xl;
      const yx = zy * xz - zz * xy,
        yy = zz * xx - zx * xz,
        yz = zx * xy - zy * xx;
      const m = ident();
      m[0] = xx;
      m[1] = yx;
      m[2] = zx;
      m[4] = xy;
      m[5] = yy;
      m[6] = zy;
      m[8] = xz;
      m[9] = yz;
      m[10] = zz;
      m[12] = -(xx * ex + xy * ey + xz * ez);
      m[13] = -(yx * ex + yy * ey + yz * ez);
      m[14] = -(zx * ex + zy * ey + zz * ez);
      return m;
    }
    function trans(x: number, y: number, z: number) {
      const m = ident();
      m[12] = x;
      m[13] = y;
      m[14] = z;
      return m;
    }

    let raf = 0;
    const draw = () => {
      const parent = canvas.parentElement;
      const w = Math.max(1, parent?.clientWidth ?? 320);
      const h = Math.max(1, parent?.clientHeight ?? 420);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.03, 0.035, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (auto) yaw += 0.006;
      const dist = 3.15;
      const ex = Math.cos(pitch) * Math.sin(yaw) * dist;
      const ey = Math.sin(pitch) * dist + 0.15;
      const ez = Math.cos(pitch) * Math.cos(yaw) * dist;
      const P = persp((42 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 20);
      const V = lookAt(ex, ey, ez, 0, -0.15, 0);
      const VP = mul(P, V);

      for (const g of geo) {
        const M = trans(0, g.ya, 0);
        const MVP = mul(VP, M);
        gl.uniformMatrix4fv(uMVP, false, MVP);
        gl.uniformMatrix4fv(uM, false, M);
        gl.uniform3f(uEye, ex, ey, ez);
        gl.uniform1f(uKind, g.kind);
        if (g.kind === 0) {
          gl.uniform3f(uColA, 0.08, 0.28, 0.55);
          gl.uniform3f(uColB, 0.95, 0.62, 0.28);
        } else {
          gl.uniform3f(uColA, 0.85, 0.68, 0.38);
          gl.uniform3f(uColB, 0.4, 0.26, 0.1);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, g.p);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPos);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.n);
        gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aN);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.i);
        gl.drawElements(gl.TRIANGLES, g.c, gl.UNSIGNED_SHORT, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className={`relative overflow-hidden bg-[#08090d] ${compact ? "h-full min-h-[220px]" : "aspect-[3/4] w-full"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/cases/lamp-levitation.jpg" alt="Saturn Lamp 主视觉" className="pointer-events-none absolute h-px w-px opacity-0" />
      <canvas ref={ref} className="block h-full w-full touch-none" style={{ cursor: "grab" }} />
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] tracking-wide text-white/45">
        拖动 360° 环绕
      </p>
    </div>
  );
}
