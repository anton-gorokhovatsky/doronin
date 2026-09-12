"""Build a replay from GPX geometry and, optionally, visible Strava lap timings."""
import bisect
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

source = Path(sys.argv[1])
root = ET.parse(source).getroot()
points = []
last = None
distance = 0
for point in root.findall('.//{*}trkpt'):
    stamp = point.find('{*}time')
    time = dt.datetime.fromisoformat(stamp.text.replace('Z', '+00:00')) if stamp is not None and stamp.text else None
    if time is not None and time.tzinfo is None:
        raise ValueError('GPX time must have an explicit timezone')
    lat, lon = float(point.attrib['lat']), float(point.attrib['lon'])
    if not (25.14 < lat < 25.19 and 55.26 < lon < 55.31):
        raise ValueError('This GPX is outside the confirmed venue bounds')
    if last:
        if time is not None and last[0] is not None and time < last[0]:
            raise ValueError('GPX timestamps must not go backwards')
        a = math.sin(math.radians(lat-last[1])/2)**2 + math.cos(math.radians(lat))*math.cos(math.radians(last[1]))*math.sin(math.radians(lon-last[2])/2)**2
        distance += 6371.0088 * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    points.append((time, lat, lon, distance))
    last = (time, lat, lon)
if len(points) < 100:
    raise ValueError('Incomplete GPX')
start, end = points[0][0], points[-1][0]
timed = all(p[0] is not None for p in points)
if timed and (start.year != 2024 or end <= start):
    raise ValueError('Expected the original, dated 2024 activity')
if any(p[0] is not None for p in points) and not timed:
    raise ValueError('Mixed missing timestamps; recover the complete original')
timing = None
reported_distance = distance
if not timed and len(sys.argv) > 2:
    laps = json.loads(Path(sys.argv[2]).read_text())
    if laps['source'] != 'https://www.strava.com/activities/13190277378/laps' or len(laps['laps']) != 203:
        raise ValueError('Expected the verified 203-part Strava table')
    distances, durations = [0], [0]
    for km, seconds in laps['laps']:
        if not (math.isfinite(km) and km > 0 and math.isfinite(seconds) and seconds > 0):
            raise ValueError('Invalid lap')
        distances.append(distances[-1] + km)
        durations.append(durations[-1] + seconds)
    if abs(distances[-1] - laps['reportedDistanceKm']) > 0.1 or abs(durations[-1] - laps['reportedElapsedSeconds']) > len(laps['laps']):
        raise ValueError('Lap totals do not reconcile with the activity')
    if abs(distance - laps['reportedDistanceKm']) / distance > 0.005:
        raise ValueError('GPX geometry does not match the activity distance')
    start = dt.datetime.fromisoformat(laps['startLocal'])
    end = start + dt.timedelta(seconds=laps['reportedElapsedSeconds'])
    reported_distance = laps['reportedDistanceKm']
    timing = {'kind': 'strava-lap-reconstruction', 'source': laps['source'], 'lapCount': len(laps['laps']),
              'startPrecision': laps['startPrecision'], 'lapDistanceKm': round(distances[-1], 3),
              'lapSeconds': durations[-1], 'elapsedSeconds': laps['reportedElapsedSeconds']}
    def reconstructed_seconds(km):
        # Both tables are rounded. Reconcile their totals; interpolate only within each lap.
        lap_km = km / distance * distances[-1]
        index = min(len(distances)-2, max(0, bisect.bisect_right(distances, lap_km)-1))
        fraction = (lap_km-distances[index]) / (distances[index+1]-distances[index])
        return (durations[index] + fraction*(durations[index+1]-durations[index])) * laps['reportedElapsedSeconds'] / durations[-1]
# Distances are accumulated on every source point, then timed samples are thinned.
minlat, maxlat = min(p[1] for p in points), max(p[1] for p in points)
minlon, maxlon = min(p[2] for p in points), max(p[2] for p in points)
scale_x = math.cos(math.radians((minlat+maxlat)/2))
width, height = (maxlon-minlon)*scale_x, maxlat-minlat
scale = min(540/width, 350/height)
xpad, ypad = (600-width*scale)/2, (410-height*scale)/2
sampled = []
last_sample = -100
for i, (time, lat, lon, km) in enumerate(points):
    elapsed = (time-start).total_seconds() if timed else reconstructed_seconds(km) if timing else km
    if elapsed - last_sample < (30 if timed or timing else 0.08) and i != len(points)-1:
        continue
    sampled.append([round(elapsed, 3), round(km/distance*reported_distance, 3), round(xpad+(lon-minlon)*scale_x*scale, 2), round(410-ypad-(lat-minlat)*scale, 2)])
    last_sample = elapsed
out = {'version': 1, 'source': 'https://www.strava.com/activities/13190277378', 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sourcePoints': len(points), 'mode': 'time' if timed or timing else 'distance', 'start': start.isoformat() if timed or timing else None, 'end': end.isoformat() if timed or timing else None, 'distanceKm': round(reported_distance, 3), 'gpxDistanceKm': round(distance, 3), 'timing': timing, 'points': sampled}
Path('src/assets/ride-2024.json').write_text(json.dumps(out, separators=(',', ':'))+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='points'}, indent=2))
print(f'{len(sampled)} replay points; source remains private')
