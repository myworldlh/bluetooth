
// 生成蓝牙开锁命令校验和
var getCheckSumCode = (arr) => {
  var sum = 0;
  var arr2 = arr.map(item => {
    return parseInt(item, 16);
  })
  for (var i = 0; i < arr2.length; i++) {
    sum ^= arr2[i]
  }
  return sum.toString(16)
}

// 生成蓝牙开锁命令
var getCommand = () => {
  // 同步头默认AA
  var SynchronizationHead = ['AA'];
  // 数据长度默认
  var DataLength = ['0A'];
  // 命令头默认01
  var CommandHeader = ['01'];
  /*-------------请求获得命令序号和密钥-------------*/
  // 命令序号2字节
  var CommandSequenceNumber = ['13', '14'];
  // 密钥2字节
  var SecretKey = ['1A', '0F'];
  /*--------------------------*/
  // 人员id 4字节
  var PersonId = ['01', '02', '03', '04'];
  // 操作码
  var Opcode = ['01'];  

  var sumArr = CommandHeader.concat(CommandSequenceNumber).concat(SecretKey).concat(PersonId).concat(Opcode);
  // 校验和
  var checkSumCode = getCheckSumCode(sumArr);

  // 开锁命令
  return SynchronizationHead.concat(DataLength).concat(sumArr).concat(checkSumCode);
}

module.exports = {
  getCheckSumCode,
  getCommand
}