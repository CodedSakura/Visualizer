import React, {ReactNode} from 'react';
import {framerate} from "../Views/App";

const dim = {w: 960, h: 540}; // dimensions: width, height

export enum Model {
  Empty = "No visualizer",
  Oscilloscope = "Oscilloscope",
  Waveform = "Waveform",
  DiffWave = "Difference Waveform",
}

interface ShapeModelBase {
  readonly f: string
}
interface LineModel extends ShapeModelBase {
  f: "line",
  v(i: number): number,
  y(i: number): number
}
interface CircleModel extends ShapeModelBase {
  f: "circle"
}

type ShapeModel = LineModel|CircleModel;

const map = (tData: Uint8Array, fData: Uint8Array, pFData: number[]): {[m in Model]: ShapeModel|ShapeModel[]|undefined} => {
  return {
    [Model.Empty]: undefined,
    [Model.Oscilloscope]: {f: "line", v: i => tData[i] / 128.0, y: v => v * dim.h / 2},
    [Model.Waveform]: {f: "line", v: i => fData[i] / 256.0, y: v => dim.h - v * dim.h},
    [Model.DiffWave]: {f: "line", v: i => (pFData[i] - fData[i] + 128) / 128.0, y: v => v * dim.h/2}
  }
};

interface Props {
  analyzer: AnalyserNode,
  model: Model
}
abstract class Visualizer extends React.Component<Props> {
  prevFData: number[] = [];
  abstract generateLine(v: (i: number) => number, y: (v: number) => number): any;

  selectGenerator(args: ShapeModel): any {
    switch (args.f) {
      case "line":
        return this.generateLine(args.v, args.y);
      case "circle":
        return null;
    }
    throw new Error()
  }
}

class SVGVisualizer extends Visualizer {
  componentDidMount() {
    setInterval(() => this.forceUpdate(), 1000 / framerate);
  }

  generateLine(v: (i: number) => number, y: (v: number) => number): ReactNode {
    const bufferLength = this.props.analyzer.frequencyBinCount;
    let d = "M";
    const sliceWidth = dim.w / bufferLength;
    for (let i = 0, x = 0; i < bufferLength; i++) {
      d += `${x},${y(v(i))} `;
      x += sliceWidth;
    }
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

  generateLine(v: (i: number) => number, y: (v: number) => number): void {
    if (!this.ref) return;
    const ctx = this.ref.getContext("2d");
    if (!ctx) return;
    const bufferLength = this.props.analyzer.frequencyBinCount;
    ctx.clearRect(0, 0, 960, 540);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    const sliceWidth = dim.w / bufferLength;
    for (let i = 0, x = 0; i < bufferLength; i++) {
      ctx.lineTo(x, y(v(i)));
      x += sliceWidth;
    }
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