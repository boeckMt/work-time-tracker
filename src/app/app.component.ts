import { Component } from '@angular/core';
import { DateTime, Duration, DateObjectUnits } from 'luxon';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from './info-dialog/info-dialog.component';
import { PwaHelper } from './pwa.helper';


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

  // Gleitende Arbeitszeit (BO)
  /**
   * after 6 h 30 min break
   * ater 9 h 45 min break
   * break between 11:30 and 14:00
   * normal allowed working time between 6:00 and 19:45
   * Core working hours Mo. - Do. 9:00 - 15:00 | Fr. 9:00 - 13:00
   */
  weekWorkTime = Duration.fromObject({ hours: 39 });
  maxDayWorkTime = Duration.fromObject({ hours: 10 });
  // -------------------------------------


  currentTime = DateTime.local();
  title = 'twork-time-tracker';
  timesKey = 'time-recording-times';
  actionKey = 'time-recording-action';
  showInfoKey = `time-recording-show-Info`;
  action: actionType = null;
  times: Itime[] = [];

  days: Iday[] = [];

  constructor(public dialog: MatDialog, private pwaHelper: PwaHelper) {
    this.pwaHelper.checkUpdates();
    this.action = this.getAction();
    this.times = this.getLastTimes();
    this.openDialog();
    this.calcOutput();
  }

  openDialog(): void {
    const showInfo = window.localStorage.getItem(this.showInfoKey);
    if (showInfo !== 'false') {
      const dialogRef = this.dialog.open(InfoDialogComponent, {
        width: '350px'
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          window.localStorage.setItem(this.showInfoKey, 'false');
        }
      });
    }
  }

  calcOutput() {
    // group dates by day YYYY-MM-DD
    this.days = [];
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

    this.calcOutput();
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

    window.localStorage.removeItem(this.actionKey);
    this.action = null;

    this.days = [];
  }

  /**
   * group array in days with keyGetter function
   */
  private groupBy(list: Itime[], keyGetter: (item: Itime) => string) {
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
  private getDayDuaration(times: Itime[]) {
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
        const d1 = DateTime.fromISO(times[0].time);
        duration = this.currentTime.diff(d1);
      } else if (item.action === 'checkIn') {
        // wait for a checkOut to get a duration
        console.log('wait for a checkOut to get a duration')
        const d1 = DateTime.fromISO(times[0].time);
        duration = this.currentTime.diff(d1);
      }
    }
    return duration;
  }

  private calcSartAndEndTime(duration: Duration, start: DateObjectUnits = { hour: 8, minute: 0, second: 0, millisecond: 0 }) {
    const current = DateTime.local();
    const startTime = current.set(start);
    if (!duration.isValid) {
      return;
    }

    const breakTime = this.getTimeForBraek(duration);
    const workAndBreak = duration.plus(breakTime);
    const endTime = startTime.plus(workAndBreak);
    return {
      start: startTime,
      end: endTime
    };
  }

  private getTimeForBraek(duration: Duration) {
    console.log('getTimeForBraek', duration);
    const durHours = duration.as('hours');
    if (durHours > 6 && durHours <= 9) {
      return Duration.fromObject({ minutes: 30 });
    } else if (durHours > 9) {
      return Duration.fromObject({ minutes: 45 });
    } else {
      return Duration.fromMillis(0);
    }
  }

  getTimesForTheDay(times: Itime[]) {
    const worktime = this.checkInAndOutCorrectForDay(times);
    console.log('getTimesForTheDay', worktime.isValid);
    const { start, end } = this.calcSartAndEndTime(worktime);
    return `${start.toFormat('HH:mm')} - ${end.toFormat('HH:mm')}`;
  }

  // TODO:
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
   */
}
