const app = getApp();
const bluetooth = require('../../utils/bluetooth.js');
const bluetooth_tools = require('../../utils/bluetooth_tools.js');
Page({
  data: {
    blueApi: null
  },
  onLoad: function(options) {
    this.setData({
      blueApi: bluetooth.blueApi
    })
    this.data.blueApi.connect();
  },
  // 开锁
  open() {
    var blueApi = this.data.blueApi;
    var msg = bluetooth_tools.getCommand();
    console.log(blueApi.blue_data.connectId, blueApi.blue_data.service_id, blueApi.blue_data.write_id, msg)
    blueApi.sendMsg(blueApi.blue_data.connectId, blueApi.blue_data.service_id, blueApi.blue_data.write_id, msg);
  },
  // 重连
  reConnect() {
    this.data.blueApi.connect();
  }
})