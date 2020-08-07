import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { DateTime, Duration, DateObjectUnits } from 'luxon';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from './info-dialog/info-dialog.component';
import { PwaHelper } from './pwa.helper';
import { saveAs } from 'file-saver';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { formatDurHHmm, getWeekDay, groupBy, actionType, Itime, Iday, ItimeDisplay, calcStartAndEndTime, getTimeForBraek } from './utils';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {



  constructor(public dialog: MatDialog, private pwaHelper: PwaHelper, private snackbar: MatSnackBar) {
    this.pwaHelper.checkUpdates();
    const targetTime = this.getTargetTime();
    if (targetTime) {
      this.targetDayWorkingTime.setValue(targetTime);
    }
    this.openDialog();
    this.calcOutput();
  }

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
  editingValue = null;

  currentTime = DateTime.local();
  title = 'twork-time-tracker';
  timesKey = 'time-recording-times';
  actionKey = 'time-recording-action';
  showInfoKey = `time-recording-show-Info`;
  targetTimeKey = `time-recording-target-time`;
  action: actionType = null;
  times: Itime[] = [];

  days: Iday[] = [];
  fullWorkingTime: Duration = Duration.fromMillis(0);
  fullWorkingDiff: Duration = Duration.fromMillis(0);

  targetDayWorkingTime = new FormControl(null);
  sub: Subscription;
  @ViewChild('fileInput') fileInput: ElementRef;

  public dateInputPattern = `([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})`;
  public dateTimeLocaleForamt = 'yyyy-MM-ddTHH:mm';

  public getWeekDay = getWeekDay;

  public formatDurHHmm = formatDurHHmm;

  ngOnInit(): void {
    this.sub = this.targetDayWorkingTime.valueChanges.subscribe((targetTime) => {
      this.setTargetTime(targetTime);
      this.calcOutput();
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  public currentEditing(event) {
    const value = event.target.value;
    this.editingValue = value;
  }

  public setEditting(item: ItimeDisplay) {
    let editing = item.editing;
    if (editing === true && this.editingValue !== null && DateTime.fromISO(this.editingValue).isValid) {
      if (item.time !== this.editingValue) {
        const newItem = Object.assign({}, item);
        const oldtime = DateTime.fromISO(newItem.time);
        // convert from datepicker adjusted time back to iso and add seconds and millisecond
        let covertLocaleToIso = DateTime.fromISO(this.editingValue);
        covertLocaleToIso = covertLocaleToIso.set({ second: oldtime.get('second'), millisecond: oldtime.get('millisecond') });
        newItem.time = covertLocaleToIso.toISO();
        newItem.editing = false;
        // console.log('editing', item, newItem);
        this.updateItem(item.time, newItem);
        this.calcOutput();
      }
      this.editingValue = null;
    } else {
      console.log('editingValue is', DateTime.fromISO(this.editingValue).isValid);
    }
    editing = !editing;
    return editing;
  }

  public checkInOut() {
    const currentTime = DateTime.local();
    const timeString = currentTime.toISO();

    if (!this.action || this.action === 'checkOut') {
      this.action = 'checkIn';

    } else if (this.action === 'checkIn') {
      this.action = 'checkOut';
    }
    this.setAction(this.action);
    this.times = this.saveTime(timeString, this.action);

    this.calcOutput();
  }


  public clearTimes() {
    window.localStorage.removeItem(this.timesKey);
    this.times = [];

    window.localStorage.removeItem(this.actionKey);
    this.action = null;

    this.days = [];
    this.fullWorkingTime = Duration.fromMillis(0);
  }

  public exportDays() {
    const daysExport = this.days.map(d => {
      return {
        date: d.day,
        time: d.totalTime.as('hours'),
        start: d.calcStart,
        end: d.calcEnd
      };
    });
    const filename = `working-times_${this.days[0].day}_${this.days[this.days.length - 1].day}.json`;
    const daysString = JSON.stringify(daysExport);
    const blob = new Blob([daysString], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename);
  }

  public exportTimes() {
    const times = this.getLastTimes();
    const filename = `check-in-out-times_${this.days[0].day}_${this.days[this.days.length - 1].day}.json`;
    const stringTimes = JSON.stringify(times);
    const blob = new Blob([stringTimes], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename);
  }

  /**
   * https://developer.mozilla.org/de/docs/Web/API/File/Zugriff_auf_Dateien_von_Webapplikationen
   */
  public openFile(evt) {
    if (this.fileInput.nativeElement) {
      // console.log(this.fileInput.nativeElement);
      this.fileInput.nativeElement.click();
    }
    evt.preventDefault();
  }

  public handleFileInput(evt) {
    const files = evt.target.files;
    this.readInputJson(files[0]);
  }

  findItemInTimes(time: string) {
    const indexItem: { item: Itime, index: number } = {
      item: null,
      index: null
    };
    this.times.map((item, index) => {
      if (item.time === time) {
        indexItem.item = item;
        indexItem.index = index;
      }
    });
    return indexItem;
  }

  deleteItem(time: string){
    const filtered = this.times.filter(i => i.time !== time);
    this.times = filtered;
    this.updateTimes(this.times);
    this.calcOutput();
  }

  updateItem(time: string, newItem: ItimeDisplay) {
    const indexItem = this.findItemInTimes(time);
    indexItem.item.time = newItem.time;
    indexItem.item.action = newItem.action;
    if (indexItem.item) {
      this.times[indexItem.index] = indexItem.item;
    }
    this.updateTimes(this.times);
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
    this.action = this.getAction();
    this.times = this.getLastTimes();


    this.fullWorkingTime = Duration.fromMillis(0);
    this.fullWorkingDiff = Duration.fromMillis(0);
    this.days = [];
    // group dates by day YYYY-MM-DD
    const daysMap = groupBy(this.times, i => i.time.split('T')[0]);
    const daysArray = Array.from(daysMap.keys()).sort();
    daysArray.forEach(day => {
      const times = daysMap.get(day);
      const displayTimes = times.map(t => {
        return {
          time: t.time,
          action: t.action,
          editing: false
        };
      });
      const timeAndCalc = this.checkInAndOutCorrectForDay(times);
      const item: Iday = {
        day,
        times: displayTimes,
        totalTime: timeAndCalc.duration,
        calcStart: timeAndCalc.calcTimes.start.toFormat('HH:mm'),
        calcEnd: timeAndCalc.calcTimes.end.toFormat('HH:mm')
      };
      const targetTime = parseFloat(this.targetDayWorkingTime.value);
      if (targetTime) {
        const targetDur = Duration.fromObject({ hours: targetTime });
        item.targetDiff = item.totalTime.minus(targetDur);
        // console.log('target diff', item.targetDiff.toObject());
        this.fullWorkingDiff = this.fullWorkingDiff.plus(item.targetDiff);
      }
      this.fullWorkingTime = this.fullWorkingTime.plus(item.totalTime);
      this.days.push(item);
    });
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
    const lastItem = times[times.length - 1];
    times.map((item, i) => {
      const nextItem = times[i + 1];
      if (item.action === 'checkIn' && nextItem && nextItem.action === 'checkOut') {
        const d1 = DateTime.fromISO(item.time);
        const d2 = DateTime.fromISO(nextItem.time);
        const diff = d2.diff(d1);
        durations.push(diff);
      }
    });

    if (times.length > 1 && lastItem.action === 'checkIn') {
      const lasTdur = durations[durations.length - 1];

      const diff = this.currentTime.diff(DateTime.fromISO(lastItem.time));
      durations.push(diff);
    }

    // sum up
    const duration = durations.reduce((a, b) => a.plus(b), Duration.fromMillis(0));
    return duration;
  }


  readInputJson(file) {
    // Check if the file is an image.
    if (file.type && file.type.indexOf('json') === -1) {
      console.log('File is not in json format.', file.type, file);
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
      const loadedTimes = event.target.result.toString();
      const jsonTimes = JSON.parse(loadedTimes);
      if (Array.isArray(jsonTimes) && jsonTimes.length > 0) {
        const first = jsonTimes[0];
        if (first.hasOwnProperty('action') && first.hasOwnProperty('time')) {
          this.updateTimes(jsonTimes, true);
          this.calcOutput();
        } else {
          this.snackbar.open(`The json file is not in the right format Array<{time: string, action: actionType}>`);
        }
      }

    });
    reader.readAsText(file, 'UTF-8');
  }


  setAction(action: actionType) {
    window.localStorage.setItem(this.actionKey, action);
  }

  getAction() {
    return window.localStorage.getItem(this.actionKey) as actionType;
  }


  setTargetTime(time: string) {
    window.localStorage.setItem(this.targetTimeKey, time);
  }

  getTargetTime() {
    return window.localStorage.getItem(this.targetTimeKey);
  }




  getLastTimes(): Itime[] {
    const times = window.localStorage.getItem(this.timesKey);
    if (times) {
      return JSON.parse(times);
    } else {
      return [];
    }
  }

  saveTime(time: string, action: actionType) {
    const times = this.getLastTimes();
    const item: Itime = { time, action };
    times.push(item);
    return this.updateTimes(times);
  }

  updateTimes(times: Itime[], add: boolean = false) {
    if (add) {
      const oldTimes = this.getLastTimes();
      times = oldTimes.concat(times);
    }

    window.localStorage.setItem(this.timesKey, JSON.stringify(times));
    return times;
  }


  checkInAndOutCorrectForDay(times: Itime[]) {
    let duration: Duration = Duration.fromMillis(0);
    let calcTimes = { start: null, end: null };
    // check if there is a duration for the day, if not -> forgot to checkOut or work over night...
    if (times.length >= 2) {
      const first = times[0];
      const last = times[times.length - 1];
      // everything is ok
      if (first.action === 'checkIn' && last.action === 'checkOut') {
        // console.log("first.action === 'checkIn' && last.action === 'checkOut'")
        duration = this.getDayDuaration(times);
        calcTimes = calcStartAndEndTime(duration);

        // if only 2 items for a day and more the 6h or 9h remove TimeForBraek
        if (times.length === 2) {
          const breakTime = getTimeForBraek(duration);
          if (breakTime.as('hours') > 0) {
            // first calc times then remove break from duration
            calcTimes = calcStartAndEndTime(duration, false);
            duration = duration.minus(breakTime);
          }
          // console.log('>>>>>>>', breakTime.as('hours'));
        }

        // forgot to checkOut or still working
      } else if (first.action === 'checkIn' && last.action === 'checkIn') {
        // console.log("first.action === 'checkIn' && last.action === 'checkIn'")
        const sliceTimes = times; // times.slice(0, times.length - 2);
        duration = this.getDayDuaration(sliceTimes);
        calcTimes = calcStartAndEndTime(duration);
        // forgot to checkOut last day
      } else if (first.action === 'checkOut' && last.action === 'checkOut') {
        // console.log("first.action === 'checkOut' && last.action === 'checkOut'")
        const sliceTimes = times.slice(1);
        duration = this.getDayDuaration(sliceTimes);
        calcTimes = calcStartAndEndTime(duration);
        // forgot to checkOut last day and still working
      } else if (first.action === 'checkOut' && last.action === 'checkIn') {
        // console.log("first.action === 'checkOut' && last.action === 'checkIn'")
        const sliceTimes = times.slice(1);
        const sliceTimes2 = sliceTimes.slice(0, sliceTimes.length - 2);
        duration = this.getDayDuaration(sliceTimes2);
        calcTimes = calcStartAndEndTime(duration);
      }
    } else if (times.length === 1) {
      // check if the single date was checkIn or checkOut
      const item = times[0];
      if (item.action === 'checkOut') {
        console.log('forgot to checkIn or work over night', times[0]);
        const d1 = DateTime.fromISO(times[0].time);
        duration = this.currentTime.diff(d1);
        calcTimes = calcStartAndEndTime(duration);
      } else if (item.action === 'checkIn') {
        // wait for a checkOut to get a duration
        console.log('wait for a checkOut to get a duration');
        const d1 = DateTime.fromISO(times[0].time);
        duration = this.currentTime.diff(d1);
        calcTimes = calcStartAndEndTime(duration);
      }
    }

    return {
      duration,
      calcTimes
    };
  }



  // TODO:
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
   */
}
