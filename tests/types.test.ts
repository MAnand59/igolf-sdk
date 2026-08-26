import {
  IGolfController,
  IGOLF_SIGN_METHOD,
  type IgolfConfig,
} from "../src";

interface CourseListResponse {
  Status: 1;
  Courses: Array<{ Id: number; Name: string }>;
}

const config: IgolfConfig = {
  baseUrl: "https://api.example.com",
  appKey: "app-key",
  apiVersion: "1.0",
  signVersion: "1.0",
  signMethod: IGOLF_SIGN_METHOD,
  appSecret: "app-secret",
};

const controller = new IGolfController(config);

async function verifyGenericResponse(): Promise<void> {
  const response = await controller.requestWithActionCode<CourseListResponse>("CourseList", {});

  if (response.stat) {
    response.data.Courses[0]?.Name.toUpperCase();
  } else {
    response.data.toUpperCase();
  }
}

void verifyGenericResponse;

const invalidConfig: IgolfConfig = {
  ...config,
  // @ts-expect-error Only HMAC-SHA256 is supported.
  signMethod: "MD5",
};

void invalidConfig;
