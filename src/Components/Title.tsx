import React from "react";
import {classMap, CurrentSong} from "../Views/App";

interface Props {
  currentSong: CurrentSong|undefined
}

export default class Title extends React.Component<Props> {
  child: ClientRect|null = null;
  parent: ClientRect|null = null;

  assignRef = (parent: boolean) => (r: HTMLElement|null) => {
    if (!r) return;
    if (parent) this.parent = r.getBoundingClientRect();
    else this.child = r.getBoundingClientRect();
  };

  render() {
    const {currentSong} = this.props;
    const loop = this.child && this.parent && this.child.width > this.parent.width * 1.4;
    return <div className="song-title" ref={this.assignRef(true)}>
      {currentSong ?
        <span className={classMap("looper", loop && "looping")}>
          <span ref={this.assignRef(false)}>{currentSong.name}</span>
          {loop ? <span>{currentSong.name}</span> : undefined}
        </span> :
        <i>No song selected</i>
      }
    </div>;
  }
}