const app = getApp();

let blueApi = {
  platform: app.globalData.platform, // 设备类型
  // 向蓝牙发送数据的必要参数
  blue_data: {
    device_id: "F6:4C:0A:97:BA:F0", // 蓝牙MAC地址，后台获得
    service_id: "", // 蓝牙服务的UUID
    notify_id: "", // notify_id, 开启notify
    write_id: "", // write_id，写入蓝牙需要的write_id
    connectId: "", // 开锁需要发送的MAC地址或UUID
    available: false, // 适配器可用情况下，防止因适配器状态改变而多次调用搜索
  },
  setBlueData(obj) {
    this.blue_data = Object.assign({}, this.blue_data, obj);
  },
  // 连接蓝牙
  connect(callback, onBluetoothAdapterStateChangeCallback) {
    if (!wx.openBluetoothAdapter) {
      this.showError("当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。");
      return;
    }
    var _this = this;
    var openBluetoothAdapterInterval = setInterval(function(){
      wx.openBluetoothAdapter({
        success() {
          callback && callback.success && callback.success();
          _this.onBluetoothAdapterStateChange();
          _this.startSearch(); // 开始搜索
        },
        fail: function(res) {
          callback && callback.fail && callback.fail()
          wx.showToast({
            title: '请开启蓝牙',
            icon: 'none'
          });
          _this.onBluetoothAdapterStateChange(onBluetoothAdapterStateChangeCallback);
        },
        complete(){
          callback && callback.complete && callback.complete()
          clearInterval(openBluetoothAdapterInterval)
        }
      })
    }, 250)
  },
  // 监听蓝牙状态变化，蓝牙状态如果不变化就不执行，蓝牙在搜索状态也是状态改变，所以会多次调用这个方法
  onBluetoothAdapterStateChange(callback) {
    var _this = this;
    wx.onBluetoothAdapterStateChange(function(res) {
      // 搜索多个蓝牙时，防止关闭搜索执行完之前，又搜到了新的蓝牙，导致关闭搜索后，新的蓝牙改变了蓝牙状态，再次开启搜索
      // 设备器只要是可用状态，就只能执行一次，切换蓝牙开关状态，会引起下一次的调用，并且只执行一次
      if (_this.blue_data.available != res.available) {
        _this.blue_data.available = res.available;

        if (res.available) { // 蓝牙适配器可用
          callback && callback.available && callback.available(); // 蓝牙开启可用callback
          if (!res.discovering) { // 蓝牙适配器不在搜索状态
            console.log('onBluetoothAdapterStateChange')
            _this.startSearch(); // 开始搜索
          }
        } else {
          wx.showToast({
            title: '蓝牙未开启',
            icon: 'none'
          })
          console.log('蓝牙适配器不可用', res)
          callback && callback.unAvailable && callback.unAvailable(); // 蓝牙关闭不可用callback
        }
      }
    })
  },
  //发送消息
  sendMsg(deviceId, service_id, write_id, msg, toArrayBuf = true) {
    let _this = this;
    let buf = toArrayBuf ? _this.hexToArrayBuffer(msg) : msg;
    wx.writeBLECharacteristicValue({
      deviceId: deviceId,
      serviceId: service_id,
      characteristicId: write_id,
      value: buf,
      success: function(res) {
        console.log('消息发送成功');
      },
      fail(res) {
        wx.showToast({
          title: '开锁失败，请重试',
          icon: 'none'
        })
        console.log('消息发送失败', res)
      }
    })
  },
  //监听消息
  onNotifyChange(deviceId) {
    var _this = this;
    wx.onBLECharacteristicValueChange(function(res) { // 监听蓝牙推送的notify数据
      let msg = _this.arrayBufferToHexString(res.value);
      let hex = msg.split(":").reverse();
      if (hex[hex.length - 2] == "00") { // 成功
        // 消息推送完成后，可以关闭蓝牙设备
        // 请求下一次开锁的命令序号和秘钥
        _this.disconnect(deviceId);
      } else if (hex[hex.length - 2] == "01") { // 失败
        wx.showToast({
          title: '开锁失败，请重试',
          icon: 'none'
        })
      }
    })
  },
  // 断开连接并关闭蓝牙设备
  disconnect(deviceId) {
    var _this = this;
    wx.closeBLEConnection({ // 关闭BLE连接
      deviceId: deviceId,
      success(res) {
        console.log('关闭BLE连接')
      },
      fail(res) {
        console.log('关闭BLE连接失败', res)
        _this.disconnect(_this.blue_data.device_id);
      }
    })
    wx.closeBluetoothAdapter({ // 关闭蓝牙释放资源
      success(res) {
        console.log('关闭蓝牙释放资源')
      },
      fail(res) {
        console.log('关闭蓝牙释放资源失败', res);
        _this.disconnect(_this.blue_data.device_id);
      }
    })
  },
  /*事件通信模块*/

  // 查找蓝牙设备
  startSearch() {
    var _this = this;
    console.log('startSearch')
    wx.startBluetoothDevicesDiscovery({
      services: [],
      success(res) {
        // 监听：寻找到新设备触发
        wx.onBluetoothDeviceFound(function(devices) {
          var devices = devices.devices;
          var device = devices[0];
          /* Android */
          if (_this.platform == "android") {
            var deviceId = device.deviceId; // 蓝牙MAC地址
            console.log(deviceId == _this.blue_data.device_id)
            if (deviceId == _this.blue_data.device_id) { // 匹配到该学生对应要连接的蓝牙锁MAC地址
              _this.stopSearch();
              _this.connectDevice(deviceId);
            }
          } else if (_this.platform == "ios") {
            /* ios */
            if (!!device.advertisData) {
              var deviceIOS = _this.filterDevice(device);
              if (deviceIOS) {
                _this.stopSearch();
                _this.connectDevice(deviceIOS.deviceId);
              }
            }
          }
        });
      },
      fail(res) {
        console.log('查找蓝牙设备功能失败', res)
        wx.showToast({
          title: '蓝牙连接失败，请重试',
          icon: 'none'
        })
      }
    })
  },
  //连接到设备
  connectDevice(deviceId, connected, disconnected) {
    var _this = this;
    // ios:deviceId => deviceId   android:deviceId => MAC地址
    wx.createBLEConnection({
      deviceId: deviceId,
      success(res) {
        if (connected) {
          connected();
        }
        // 保存连接的uuid或mac地址
        _this.blue_data.connectId = deviceId;
        console.log('蓝牙连接成功')
        _this.getDeviceService(deviceId);
      },
      fail(res) {
        if (disconnected) {
          disconnected();
        }
        wx.showToast({
          title: '蓝牙连接失败，请重试',
          icon: 'none'
        })
        console.log('蓝牙连接失败', res)
      },
      complete(res) {
        // 连接成功后，锁的状态是开启状态
        // 连接失败后，锁的状态是关闭状态
        _this.onBLEConnectionStateChange(connected, disconnected);
      }
    })
  },
  // 监听蓝牙连接状态改变
  onBLEConnectionStateChange(connected, disconnected) {
    wx.onBLEConnectionStateChange(function(res) {
      if (res.connected) {
        if (connected) {
          connected();
        }
      } else {
        if (disconnected) {
          disconnected();
        }
      }
    })
  },
  //搜索设备服务列表
  getDeviceService(deviceId) {
    var _this = this;
    wx.getBLEDeviceServices({ // 获取蓝牙下的所有服务列表
      deviceId: deviceId,
      success: function(res) {
        var service_id = _this.filterService(res.services); // 过滤服务列表
        if (service_id != "") {
          _this.blue_data.service_id = service_id;
          _this.getDeviceCharacter(deviceId, service_id);
        }
        console.log('搜索设备服务列表成功')
      },
      fail(res) {
        wx.showToast({
          title: '连接蓝牙失败，请重试',
          icon: 'none'
        })
        console.log('搜索设备服务列表', res);
      }
    })
  },
  //获取连接设备的所有特征值  
  getDeviceCharacter(deviceId, service_id) {
    let _this = this;
    wx.getBLEDeviceCharacteristics({ // 获得服务下的所有特征
      deviceId: deviceId,
      serviceId: service_id,
      success: function(res) {
        let notify_id, write_id;
        for (let i = 0; i < res.characteristics.length; i++) {
          let charc = res.characteristics[i];
          if (charc.properties.notify) { // 允许notify操作
            notify_id = charc.uuid;
          }
          if (charc.properties.write) { // 允许notify操作
            write_id = charc.uuid;
          }
        }
        if (!!notify_id && !!write_id) { // 开启了notify和write功能后，可以传递参
          _this.blue_data.notify_id = notify_id;
          _this.blue_data.write_id = write_id;
          _this.openNotify(deviceId, service_id, notify_id, write_id);
          console.log('获取连接设备的所有特征值成功')
        } else {
          wx.showToast({
            title: '连接蓝牙失败，请重试',
            icon: 'none'
          })
        }
      },
      fail(res) {
        wx.showToast({
          title: '连接蓝牙失败，请重试',
          icon: 'none'
        })
        console.log('获取连接设备的所有特征值', res)
      }
    })
  },
  // 启用低功耗蓝牙设备特征值变化时的 notify 功能
  openNotify(deviceId, service_id, notify_id, write_id) {
    var _this = this;
    wx.notifyBLECharacteristicValueChange({
      state: true, // 启用 notify
      deviceId: deviceId,
      serviceId: service_id,
      characteristicId: notify_id,
      success(res) {
        console.log('notify 功能开启')
        _this.onNotifyChange(deviceId); // 监听消息，参数为接收到数据后的回调函数
      },
      fail(res) {
        wx.showToast({
          title: '连接蓝牙失败，请重试',
          icon: 'none'
        })
        console.log('notify 功能开启失败', res);
      }
    })
  },
  /*连接设备模块*/


  /*其他辅助模块*/
  //停止搜索周边设备  
  stopSearch() {
    var _this = this;
    wx.stopBluetoothDevicesDiscovery({
      success: function(res) {
        console.log('stopSearch')
      },
      fail(res) {
        console.log('停止搜索失败')
        _this.stopSearch();
      }
    })
  },
  // ArrayBuffer转16进制字符串
  arrayBufferToHexString(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).reverse().join(':').toUpperCase();
  },
  // 16进制字符串转ArrayBuffer
  hexToArrayBuffer(arr) {
    var length = arr.length
    var buffer = new ArrayBuffer(length + 2)
    var dataview = new DataView(buffer)
    for (let i = 0; i < length; i++) {
      dataview.setUint8(i, '0x' + arr[i])
    }
    return buffer
  },
  //过滤目标设备
  filterDevice(device) {
    var data = blueApi.arrayBufferToHexString(device.advertisData.slice(2, 8)); // advertisData广播对象，由此得到MAC地址
    // 请求判断是否是我应该连接的MAC地址
    // F6:4C:0A:97:BA:F0 请求匹配到的
    if (!!data && data == this.blue_data.device_id) {
      var obj = {
        name: device.name,
        deviceId: device.deviceId // uuid
      }
      return obj
    } else {
      return null;
    }
  },
  //过滤主服务
  filterService(services) {
    // let service_id = "";
    // for (let i = 0; i < services.length; i++) {
    //   if (services[i].uuid.toUpperCase().indexOf(this.server_info) != -1) {
    //     service_id = services[i].uuid;
    //     break;
    //   }
    // }

    return services[0].uuid;
  }
  /*其他辅助模块*/
}

module.exports ={
  blueApi
}