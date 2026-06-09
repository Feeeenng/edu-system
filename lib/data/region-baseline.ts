// 由 data/教育行业客户运营清单.xlsx 的「双一流+重点本科」sheet 汇总生成。
// 全国高校总数按业务口径固定为 1695；省份分母来自 Excel 省份高校数量。
export const NATIONAL_UNIVERSITY_TOTAL = 1695;

export type RegionBaseline = {
  province: string;
  total: number;
  sddcDeployed: number;
};

export const REGION_BASELINES: RegionBaseline[] = [
  {
    "province": "上海市",
    "total": 28,
    "sddcDeployed": 11
  },
  {
    "province": "云南省",
    "total": 3,
    "sddcDeployed": 3
  },
  {
    "province": "内蒙古自治区",
    "total": 2,
    "sddcDeployed": 1
  },
  {
    "province": "北京市",
    "total": 49,
    "sddcDeployed": 18
  },
  {
    "province": "吉林省",
    "total": 6,
    "sddcDeployed": 2
  },
  {
    "province": "四川省",
    "total": 23,
    "sddcDeployed": 16
  },
  {
    "province": "天津市",
    "total": 14,
    "sddcDeployed": 6
  },
  {
    "province": "宁夏回族自治区",
    "total": 2,
    "sddcDeployed": 2
  },
  {
    "province": "安徽省",
    "total": 11,
    "sddcDeployed": 7
  },
  {
    "province": "山东省",
    "total": 16,
    "sddcDeployed": 12
  },
  {
    "province": "山西省",
    "total": 6,
    "sddcDeployed": 4
  },
  {
    "province": "广东省",
    "total": 21,
    "sddcDeployed": 11
  },
  {
    "province": "广西壮族自治区",
    "total": 4,
    "sddcDeployed": 3
  },
  {
    "province": "新疆维吾尔自治区",
    "total": 3,
    "sddcDeployed": 1
  },
  {
    "province": "江苏省",
    "total": 27,
    "sddcDeployed": 15
  },
  {
    "province": "江西省",
    "total": 12,
    "sddcDeployed": 12
  },
  {
    "province": "河北省",
    "total": 7,
    "sddcDeployed": 2
  },
  {
    "province": "河南省",
    "total": 9,
    "sddcDeployed": 5
  },
  {
    "province": "浙江省",
    "total": 21,
    "sddcDeployed": 14
  },
  {
    "province": "海南省",
    "total": 4,
    "sddcDeployed": 1
  },
  {
    "province": "湖北省",
    "total": 18,
    "sddcDeployed": 9
  },
  {
    "province": "湖南省",
    "total": 14,
    "sddcDeployed": 6
  },
  {
    "province": "甘肃省",
    "total": 7,
    "sddcDeployed": 6
  },
  {
    "province": "福建省",
    "total": 7,
    "sddcDeployed": 3
  },
  {
    "province": "西藏自治区",
    "total": 1,
    "sddcDeployed": 0
  },
  {
    "province": "贵州省",
    "total": 3,
    "sddcDeployed": 2
  },
  {
    "province": "辽宁省",
    "total": 18,
    "sddcDeployed": 12
  },
  {
    "province": "重庆市",
    "total": 10,
    "sddcDeployed": 5
  },
  {
    "province": "陕西省",
    "total": 21,
    "sddcDeployed": 5
  },
  {
    "province": "青海省",
    "total": 1,
    "sddcDeployed": 0
  },
  {
    "province": "黑龙江省",
    "total": 11,
    "sddcDeployed": 7
  }
];
