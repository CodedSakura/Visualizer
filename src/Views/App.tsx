import React from 'react';
import * as mm from 'music-metadata-browser';
import '../Style/App.scss';
import {CanvasVisualizer, Model, SVGVisualizer} from "../Components/Visualizer";
import {Icon} from "../Components/Icon";
import {Progress} from "../Components/Progress";
import Title from "../Components/Title";
import Time from "../Components/Time";

const optionStorage = "optionStorage";
export const framerate = 30;

export const time = (len: number): string => `${Math.floor(len / 60)}:${len % 60 < 10 ? "0" : ""}${Math.floor(len % 60)}`;
const limit = (min: number, val: number, max: number) => Math.max(min, Math.min(val, max));

export const classMap = (...classes: (any)[]): string|undefined => {
  let out = "";
  for (const c of classes)
    if (Array.isArray(c)) out = classMap(out, ...c) || "";
    else if (c) out += " " + c;
  return out.trim() || undefined;
};


interface Song {
  path: string,
  name: string,
  length: number,
  custom: boolean,
  objURL: string
}
export interface CurrentSong extends Song {
  source: MediaElementAudioSourceNode
}


interface StorageState {
  volume: number|null,
  volBank: number,
  autoStart: boolean,
  autoplay: boolean
}

interface State {
  volume: number|null,
  songs: Song[], currentSong: CurrentSong|undefined,
  model: Model,
  autoStart: boolean, autoplay: boolean,
  refreshCounter: number
}

class App extends React.Component<{}, State> {
  state: State;
  timeRef: HTMLSpanElement|undefined;
  volRef: HTMLSpanElement|undefined;
  volBank: number = 30;
  dragState = false;
  fileSelector: HTMLInputElement;
  audioContext = new AudioContext();
  gainNode = this.audioContext.createGain();
  analyzerNode = this.audioContext.createAnalyser();

  constructor(props: {}) {
    super(props);
    const {volBank, ...rest}: StorageState = JSON.parse(localStorage.getItem(optionStorage) || "{}");
    this.volBank = volBank;

    this.state = {
      refreshCounter: 0,
      songs: [], currentSong: undefined,
      model: Model.Empty,
      volume: 30,
      ...rest
    };
    this.volumeChange();

    this.analyzerNode.fftSize = 2048;
    this.analyzerNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.fileSelector = document.createElement('input');
    this.fileSelector.setAttribute('type', 'file');
    this.fileSelector.setAttribute('multiple', 'multiple');
    this.fileSelector.setAttribute('accept', 'audio/*');
    this.fileSelector.addEventListener('change', this.handleFileSelect);

    window.addEventListener("beforeunload", () => {
      const options: StorageState = {
        volume: this.state.volume, volBank: this.volBank,
        autoStart: this.state.autoStart, autoplay: this.state.autoplay
      };
      localStorage.setItem(optionStorage, JSON.stringify(options));
    });
  }

  async componentWillMount() {
    (await fetch("/songs/list.txt").then(r => r.text())).trim().split("\n").forEach(file => {
      fetch(`/songs/${file}`).then(r => r.blob()).then(blob => this.songInfo(blob, file));
    });
  }

  componentDidMount() {
    document.addEventListener("keydown", this.keydown);
  }

  keydown = (e: KeyboardEvent) => {
    if (["Space", "KeyM", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    else return;

    let {volume = this.volBank, currentSong} = this.state;
    const time = currentSong ? currentSong.source.mediaElement.currentTime : 0;
    const changeVol = (diff: number) => this.setState({volume: volume! + diff}, this.volumeChange);
    const seek = (time: number) => {
      if (!currentSong) return;
      currentSong.source.mediaElement.currentTime = time;
    };
    switch (e.code) {
      case "Space":
        this.togglePause();
        break;
      case "KeyM":
        this.toggleMute();
        break;
      case "ArrowUp":
        if (e.shiftKey) changeVol(+5);
        else if (e.ctrlKey) changeVol(+0.1);
        else changeVol(+1);
        break;
      case "ArrowDown":
        if (e.shiftKey) changeVol(-5);
        else if (e.ctrlKey) changeVol(-0.1);
        else changeVol(-1);
        break;
      case "ArrowRight":
        if (e.shiftKey) {
          // this.props.playNext();
        } else seek(time + 5);
        break;
      case "ArrowLeft":
        if (e.shiftKey) {
          if (time > 10) seek(0);
          // else this.props.prev();
        } else seek(time - 5);
        break;
    }
  };

  songInfo(song: Blob, file: string, custom = false) {
    (async () => {
      const {format: {duration}, common: {artist, title}} = await mm.parseBlob(song);
      this.setState(state => {
        state.songs.push({
          path: file,
          length: duration || 0,
          name: title ? artist ? `${artist} - ${title}` : title : file.replace(/\.[^/.]+$/, ""),
          custom: custom,
          objURL: URL.createObjectURL(song)
        });
        return state;
      });
    })();
  }

  volumeChange = () => {
    this.gainNode.gain.value = (this.state.volume || 0) / 100;
  };
  volumeMouse = (e: React.MouseEvent|MouseEvent) => {
    if (["mouseup", "mousedown"].includes(e.type)) {
      this.dragState = e.type === "mousedown";
    }
    if (e.type === "wheel") {
      e.preventDefault();
      const dir = -(e as WheelEvent).deltaY;
      this.setState(({volume: vol}) => ({volume: limit(0, (vol || this.volBank) + Math.sign(dir), 100)}), this.volumeChange);
      return;
    }
    if ((e.type === "mousemove" && e.buttons !== 1) || !this.volRef || !this.dragState) return;
    const t = this.volRef.getBoundingClientRect(),
      vol = limit(0, (e.clientX - t.left) / t.width * 100, 100);
    this.setState({volume: vol}, this.volumeChange);
    this.volBank = vol;
  };
  volumeTouch = (e: React.TouchEvent) => {
    console.log(e.type, e);
  };

  seekMouse = (e: React.MouseEvent) => {
    if (!this.timeRef || e.type === "mousedown" || !this.state.currentSong) return;
    const t = this.timeRef.getBoundingClientRect(),
      pos = limit(0, (e.clientX - t.left) / t.width, 1) * this.state.currentSong.length;
    const me = this.state.currentSong.source.mediaElement;
    me.currentTime = pos;
  };

  _forceUpdate = () => this.forceUpdate();
  play = (song: Song) => {
    const cs: CurrentSong = {...song, source: this.audioContext.createMediaElementSource(new Audio(song.objURL))};
    cs.source.connect(this.analyzerNode);
    cs.source.mediaElement.addEventListener("pause", this._forceUpdate);
    cs.source.mediaElement.addEventListener("play", this._forceUpdate);
    if (this.state.currentSong) {
      const s = this.state.currentSong;
      s.source.mediaElement.addEventListener("pause", this._forceUpdate);
      s.source.mediaElement.addEventListener("play", this._forceUpdate);
      s.source.disconnect();
    }
    this.setState({currentSong: cs}, () => {
      const {currentSong: {source = null} = {}, autoStart} = this.state;
      if (this.audioContext.state === 'suspended') this.audioContext.resume().then(console.log);
      if (source && autoStart) source.mediaElement.play().then();
    });
  };

  toggleAutoplay = () => {
    this.setState(s => ({autoplay: !s.autoplay}));
  };
  toggleMute = () => {
    this.setState(_s => {
      const s = {..._s};
      if (s.volume === null) {
        s.volume = this.volBank;
      } else {
        this.volBank = s.volume;
        s.volume = null;
      }
      return s;
    }, this.volumeChange);
  };
  togglePause = () => {
    const {currentSong} = this.state;
    if (!currentSong) return;
    if (currentSong.source.mediaElement.paused)
      currentSong.source.mediaElement.play().then();
    else
      currentSong.source.mediaElement.pause();
  };

  handleFileSelect = () => {
    const {files} = this.fileSelector;
    console.log(files);
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      this.songInfo(files[i], files[i].name, true);
    }
  };

  songSort = (a: Song, b: Song): number => {
    return a.custom === b.custom
      ? a.name > b.name ? 1 : -1
      : a.custom        ? 1 : -1;
  };

  render() {
    const {volume, model, songs, currentSong} = this.state;
    return <div className="container">
      <div className="visualizers">
        <SVGVisualizer analyzer={this.analyzerNode} model={model}/>
        <CanvasVisualizer analyzer={this.analyzerNode} model={model}/>
      </div>
      <div className="controller">
        <ul className="list models">{Object.values(Model).map((v: Model, k) =>
          <li key={k} className={model === v ? "selected" : undefined} onClick={() => this.setState({model: v})}>{v}</li>
        )}</ul>
        <div className="control">
          <Title currentSong={currentSong}/>
          <div className="flex f-3 buttons controls">
            <div><Icon name="prev"/></div>
            <div onClick={this.togglePause}><Icon name={currentSong ? currentSong.source.mediaElement.paused ? "play" : "pause" : "play"}/></div>
            <div><Icon name="next"/></div>
          </div>
          <Time currentSong={currentSong} seekMouse={this.seekMouse} ref={r => this.timeRef = (r as HTMLSpanElement|undefined)}/>
          <div className="flex f-3 buttons">
            <div onClick={() => this.fileSelector.click()}>Load your own songs</div>
            <div onClick={() => this.setState(s => ({autoStart: !s.autoStart}))}
                 className={this.state.autoStart ? "selected" : undefined}>auto-start</div>
            <div onClick={this.toggleAutoplay} className={this.state.autoplay ? "selected" : undefined}>autoplay</div>
          </div>
          <div className="flex">
            <span><Icon name={`vol-${!volume ? "mute" : volume >= 50 ? "2" : "1"}`} onClick={this.toggleMute}/></span>
            <Progress className={volume === null ? "suppressed" : undefined} position={volume || this.volBank}
                      onMouse={this.volumeMouse} onTouch={this.volumeTouch} ref={(r: HTMLSpanElement) => {
              if (r && !this.volRef) {
                document.body.addEventListener('mousemove', this.volumeMouse);
                document.body.addEventListener('mouseup', this.volumeMouse);
                r.addEventListener('wheel', this.volumeMouse, {passive: false});
              }
              this.volRef = r;
            }}/>
            <span>{(volume || 0).toFixed(0)}%</span>
          </div>
          <div className="hr"/>
        </div>
        <ul className="list songs">{songs.sort(this.songSort).map((v: Song, k) =>
          <li key={k} onClick={() => {this.play(v)}}
              className={classMap(currentSong && (currentSong.path === v.path) && "selected", v.custom && "custom")}>
            <span className="title" title={v.name}>{v.name}</span>
            <span className="duration">{time(v.length)}</span>
          </li>
        )}</ul>
      </div>
    </div>;
  }
}

export default App;