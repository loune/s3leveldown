import * as AWS from 'aws-sdk';
import { AbstractLevelDOWN } from 'abstract-leveldown';

export interface S3LevelDOWN extends AbstractLevelDOWN<any, any> {}

interface S3LevelDOWNConstructor {
  new (location: string, s3: AWS.S3 = undefined): any;
  (location: string, s3: AWS.S3 = undefined): any;
}

declare var S3LevelDOWN: S3LevelDOWNConstructor;

export default S3LevelDOWN;
