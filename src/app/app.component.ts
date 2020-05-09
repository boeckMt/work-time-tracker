import { Component } from '@angular/core';
import { DateTime, Duration } from 'luxon';


type actionType = 'checkIn' | 'checkOut';
interface Itime {
  time: string;
  action: actionType;
}

interface Iday {
  times: Itime[];
  day: string;
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

  days: Iday[] = [];

  constructor() {
    this.action = this.getAction();
    this.times = this.getLastTimes();


    // group dates by day YYYY-MM-DD
    const daysMap = this.groupBy(this.times, i => i.time.split('T')[0]);
    daysMap.forEach((value, key) => {
      this.days.push({ day: key, times: value });
    });
  }

  checkInOut() {
    const currentTime = DateTime.local();
    const timeString = currentTime.toISO();

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

  /**
   * group array in days with keyGetter function
   */
  groupBy(list: Itime[], keyGetter: (item: Itime) => string) {
    const map = new Map();
    list.forEach((item) => {
      const key = keyGetter(item);
      const collection = map.get(key);
      if (!collection) {
        map.set(key, [item]);
      } else {
        collection.push(item);
      }
    });
    return map;
  }

  /**
   * sum up times between checkIn - checkOut
   *
   * check what to do if day starts with checkOut?? -> forgot to checkOut or work over night...
   * what to do if day ends with checkIn?? -> forgot to checkOut or work over night...
   */
  getDayDuaration(times: Itime[]) {
    /** number in minutes */
    const durations: Duration[] = [];
    times.map((item, i) => {
      const nextItem = times[i + 1];
      if (item.action === 'checkIn' && nextItem && nextItem.action === 'checkOut') {
        const d1 = DateTime.fromISO(item.time);
        const d2 = DateTime.fromISO(nextItem.time);
        const diff = d2.diff(d1);
        durations.push(diff);
      }
    });

    // sum up
    const duration = durations.reduce((a, b) => a.plus(b), Duration.fromMillis(0));
    return duration;
  }

  checkInAndOutCorrectForDay(times: Itime[]) {
    let duration: Duration = Duration.fromMillis(0);
    // check if there is a duration for the day, if not -> forgot to checkOut or work over night...
    if (times.length >= 2) {
      const first = times[0];
      const last = times[times.length - 1];
      // everything is ok
      if (first.action === 'checkIn' && last.action === 'checkOut') {
        duration = this.getDayDuaration(times);
        // forgot to checkOut or work over night
      } else if (first.action === 'checkOut' && last.action === 'checkOut') {
        const sliceTimes = times.slice(1);
        duration = this.getDayDuaration(sliceTimes);
        // console.log('forgot to checkIn or work over night', times[0]);
      } else if (last.action === 'checkIn' && first.action === 'checkIn') {
        const sliceTimes = times.slice(0, times.length - 2);
        duration = this.getDayDuaration(sliceTimes);
        // console.log('forgot to checkOut or work over night', times[times.length - 1]);
      } else if (first.action === 'checkOut' && last.action === 'checkIn') {
        const sliceTimes = times.slice(1);
        const sliceTimes2 = sliceTimes.slice(0, sliceTimes.length - 2);
        duration = this.getDayDuaration(sliceTimes2);
      }
    } else if (times.length === 1) {
      // check if the single date was checkIn or checkOut
      const item = times[0];
      if (item.action === 'checkOut') {
        console.log('forgot to checkIn or work over night', times[0]);
      } else if (item.action === 'checkIn') {
        // wait for a checkOut to get a duration
      }
    }
    return duration;
  }
}
