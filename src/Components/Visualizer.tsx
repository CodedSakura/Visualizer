import React, {ReactNode} from 'react';
import {framerate} from "../Views/App";

const dim = {w: 960, h: 540}; // dimensions: width, height

export enum Model {
  Empty = "No visualizer",
  Oscilloscope = "Oscilloscope",
  Waveform = "Waveform",
  DiffWave = "Difference Waveform",
  WaveCircle = "Circular Waveform"
}

interface ShapeModelBase {
  readonly f: string
}
interface LineModel extends ShapeModelBase {
  f: "line",
  y(i: number): number
}
interface CircleModel extends ShapeModelBase {
  f: "circle",
  readonly props: {x: number, y: number},
  r(i: number): number
}

type ShapeModel = LineModel|CircleModel;

const map = (tData: Uint8Array, fData: Uint8Array, pFData: number[]): {[m in Model]: ShapeModel|ShapeModel[]|undefined} => {
  return {
    [Model.Empty]: undefined,
    [Model.Oscilloscope]: {f: "line", y: i => tData[i] / 128.0 * dim.h / 2},
    [Model.Waveform]: {f: "line", y: i => dim.h - fData[i] / 256.0 * dim.h},
    [Model.DiffWave]: {f: "line", y: i => (pFData[i] - fData[i] + 128) / 256.0 * dim.h},
    [Model.WaveCircle]: {f: "circle", props: {x: dim.w/2, y: dim.h/2}, r: i => fData[i] / 256.0 * dim.h/4 + dim.h/8}
  }
};

interface Props {
  analyzer: AnalyserNode,
  model: Model
}
abstract class Visualizer extends React.Component<Props> {
  prevFData: number[] = [];
  abstract generateLine(m: LineModel): any;
  abstract generateCircle(m: CircleModel): any;

  selectGenerator(args: ShapeModel): any {
    switch (args.f) {
      case "line":
        return this.generateLine(args);
      case "circle":
        return this.generateCircle(args);
    }
    throw new Error()
  }
}

class SVGVisualizer extends Visualizer {
  componentDidMount() {
    setInterval(() => this.forceUpdate(), 1000 / framerate);
  }

  generateLine(m: LineModel): ReactNode {
    const bufferLength = this.props.analyzer.frequencyBinCount;
    let d = "M";
    const sliceWidth = dim.w / bufferLength;
    for (let i = 0, x = 0; i < bufferLength; i++) {
      d += `${x},${m.y(i)} `;
      x += sliceWidth;
    }
    return <path d={d} strokeWidth={1} stroke={"rgba(255, 255, 255, 0.4)"} fill="none"/>;
  }
  generateCircle(m: CircleModel): ReactNode {
    const bufferLength = this.props.analyzer.frequencyBinCount;
    let d = "M";
    const sliceWidth = 2*Math.PI / bufferLength;
    for (let i = 0, a = 0; i < bufferLength; i++) {
      const r = m.r(i);
      d += `${m.props.x + Math.sin(a)*r},${m.props.y - Math.cos(a)*r} `;
      a += sliceWidth;
    }
    d += "Z";
    return <path d={d} strokeWidth={1} stroke={"rgba(255, 255, 255, 0.4)"} fill="none"/>;
  }

  render() {
    const bufferLength = this.props.analyzer.frequencyBinCount;
    const tData = new Uint8Array(bufferLength);
    this.props.analyzer.getByteTimeDomainData(tData);
    const fData = new Uint8Array(bufferLength);
    this.props.analyzer.getByteFrequencyData(fData);
    let out: ReactNode[]|undefined = undefined;

    let m = map(tData, fData, this.prevFData)[this.props.model];
    if (m) {
      out = [];
      if (!Array.isArray(m)) m = [m];
      for (const model of m) out.push(this.selectGenerator(model));
    }

    this.prevFData = Array.from(fData);
    return <svg viewBox={`0 0 ${dim.w} ${dim.h}`}>{out}</svg>;
  }
}

class CanvasVisualizer extends Visualizer {
  ref: HTMLCanvasElement|null = null;
  componentDidMount() {
    setInterval(this.updateCanvas, 1000 / framerate);
  }
  getCanvasContext(): CanvasRenderingContext2D|undefined {
    if (!this.ref) return;
    const ctx = this.ref.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 960, 540);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    return ctx;
  }

  generateLine(m: LineModel): void {
    const ctx = this.getCanvasContext();
    if (!ctx) return;
    const bufferLength = this.props.analyzer.frequencyBinCount;
    const sliceWidth = dim.w / bufferLength;
    ctx.beginPath();
    for (let i = 0, x = 0; i < bufferLength; i++) {
      ctx.lineTo(x, m.y(i));
      x += sliceWidth;
    }
    ctx.stroke();
  }
  generateCircle(m: CircleModel): void {
    const ctx = this.getCanvasContext();
    if (!ctx) return;
    const bufferLength = this.props.analyzer.frequencyBinCount;
    const sliceWidth = 2*Math.PI / bufferLength;
    ctx.beginPath();
    for (let i = 0, a = 0; i < bufferLength; i++) {
      const r = m.r(i);
      ctx.lineTo(m.props.x + Math.sin(a)*r, m.props.y - Math.cos(a)*r);
      a += sliceWidth;
    }
    ctx.closePath();
    ctx.stroke();
  }

  updateCanvas = () => {
    const bufferLength = this.props.analyzer.frequencyBinCount;
    const tData = new Uint8Array(bufferLength);
    this.props.analyzer.getByteTimeDomainData(tData);
    const fData = new Uint8Array(bufferLength);
    this.props.analyzer.getByteFrequencyData(fData);

    let m = map(tData, fData, this.prevFData)[this.props.model];
    if (m) {
      if (!Array.isArray(m)) m = [m];
      for (const model of m) this.selectGenerator(model);
    }

    this.prevFData = Array.from(fData);
  };
  render() {
    return <canvas ref={r => this.ref = r} width={dim.w} height={dim.h}/>;
  }
}

export {SVGVisualizer, CanvasVisualizer};