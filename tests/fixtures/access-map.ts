/** Invented pedestrian network for tests. It is not a real-world access survey. */
export const ACCESS_START={lat:33.81,lon:-118.354};
export const ACCESS_END={lat:33.81,lon:-118.352};
export const ACCESS_RAMP_POINT={lat:33.8107,lon:-118.353};
export const fullAccessTags={highway:'footway',surface:'asphalt',incline:'4%',width:'1.5',wheelchair:'yes'};
export function accessMapFixture() {
  return {elements:[
    {type:'node',id:1,...ACCESS_START},{type:'node',id:2,lat:33.81,lon:-118.353},{type:'node',id:3,...ACCESS_END},{type:'node',id:4,...ACCESS_RAMP_POINT},{type:'node',id:5,lat:33.8088,lon:-118.353},
    {type:'way',id:10,nodes:[1,2,3],tags:{highway:'steps',name:'Synthetic stair shortcut','ramp:wheelchair':'yes'}},
    {type:'way',id:11,nodes:[1,4,3],tags:{...fullAccessTags,ramp:'yes',name:'Synthetic gentle ramp'}},
    {type:'way',id:12,nodes:[1,5,3],tags:{...fullAccessTags,incline:'1%',name:'Synthetic flat detour'}},
  ]};
}
