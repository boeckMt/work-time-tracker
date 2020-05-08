import { Component } from '@angular/core';
import { DateTime } from 'luxon';


type actionType = 'checkIn' | 'checkOut';
interface Itime {
  time: string;
  action: actionType;
}


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  timesKey = 'time-recording-times';
  actionKey = 'time-recording-action';
  action: actionType = null;
  times: Itime[] = [];

  constructor() {
    this.action = this.getAction();
    this.times = this.getLastTimes();
  }

  checkInOut() {
    const currentTime = DateTime.local();
    const timeString = currentTime.toISO();//.toFormat('HH:mm:ss');

    if (!this.action || this.action === 'checkOut') {
      this.action = 'checkIn';

    } else if (this.action === 'checkIn') {
      this.action = 'checkOut';
    }
    this.setAction(this.action);
    this.times = this.saveTimes(timeString, this.action);
  }

  getAction() {
    return window.localStorage.getItem(this.actionKey) as actionType;
  }

  setAction(action: actionType) {
    window.localStorage.setItem(this.actionKey, action);
  }


  getLastTimes(): Itime[] {
    const times = window.localStorage.getItem(this.timesKey);
    if (times) {
      return JSON.parse(times);
    } else {
      return [];
    }
  }

  saveTimes(time: string, action: actionType) {
    const times = this.getLastTimes();
    const item: Itime = { time, action };
    times.push(item);
    window.localStorage.setItem(this.timesKey, JSON.stringify(times));
    return times;
  }

  clearTimes() {
    window.localStorage.removeItem(this.timesKey);
    this.times = [];

    window.localStorage.removeItem(this.actionKey)
    this.action = null;
  }
}
