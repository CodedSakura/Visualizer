import React from "react";
import {Progress} from "./Progress";
import {CurrentSong, time} from "../Views/App";

interface TimeProps {
  currentSong: CurrentSong|undefined,
  seekMouse(e: React.MouseEvent): any
}
interface _TimeProps extends TimeProps {
  innerRef: any
}

class Time extends React.Component<_TimeProps> {
  componentDidMount() {
    setInterval(() => this.forceUpdate(), 100);
  }

  render() {
    const {currentSong, seekMouse} = this.props;
    return <div className="flex">
      <span>{currentSong ? time(currentSong.source.mediaElement.currentTime) : "0:00"}</span>
      <Progress position={currentSong ? (currentSong.source.mediaElement.currentTime / currentSong.length * 100) : 0}
                className={currentSong ? undefined : "suppressed"} animated onMouse={seekMouse} ref={this.props.innerRef}/>
      <span>{currentSong ? time(currentSong.length) : "0:00"}</span>
    </div>;
  }
}

export default React.forwardRef((props: TimeProps, r) => <Time innerRef={r} {...props}/>);