import { DateTime, Duration, DateObjectUnits } from 'luxon';


export type actionType = 'checkIn' | 'checkOut';

export interface Itime {
  time: string;
  action: actionType;
}

export interface ItimeDisplay extends Itime {
  editing: boolean;
}

export interface Iday {
  times: ItimeDisplay[];
  day: string;
  totalTime: Duration;
  calcStart: string;
  calcEnd: string;
  targetDiff?: Duration;
}


export function formatDurHHmm(duration: Duration) {
  const hhmm = duration.toFormat('hh mm').split(' ');
  let time = `${hhmm[0]}h`;
  if (hhmm[0] !== '00' && hhmm[1] !== '00') {
    time = `${hhmm[0]}h ${hhmm[1]}min`;
  } else if (hhmm[0] === '00' && hhmm[1] !== '00') {
    time = `${hhmm[1]}min`;
  }
  return time;
}

export function getWeekDay(time: string) {
  const wd = DateTime.fromISO(time).weekday;
  const weekdays = {
    1: 'Mo',
    2: 'Di',
    3: 'Mi',
    4: 'Do',
    5: 'Fr',
    6: 'Sa',
    7: 'So'
  };
  return weekdays[wd];
}

/**
 * group array in days with keyGetter function
 */
export function groupBy(list: Itime[], keyGetter: (item: Itime) => string) {
  const map = new Map<string, Itime[]>();
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


export function calcStartAndEndTime(duration: Duration, addAndBreak = true, start: DateObjectUnits = { hour: 8, minute: 0, second: 0, millisecond: 0 }) {
  const current = DateTime.local();
  const startTime = current.set(start);
  if (!duration.isValid) {
    return;
  }
  let workAndBreak;
  if (addAndBreak) {
    const breakTime = getTimeForBraek(duration);
    workAndBreak = duration.plus(breakTime);
  } else {
    workAndBreak = duration;
  }

  const endTime = startTime.plus(workAndBreak);
  return {
    start: startTime,
    end: endTime
  };
}

export function getTimeForBraek(duration: Duration) {
  // console.log('getTimeForBraek', duration);
  const durHours = duration.as('hours');
  if (durHours > 6 && durHours <= 9) {
    return Duration.fromObject({ minutes: 30 });
  } else if (durHours > 9) {
    return Duration.fromObject({ minutes: 45 });
  } else {
    return Duration.fromMillis(0);
  }
}
