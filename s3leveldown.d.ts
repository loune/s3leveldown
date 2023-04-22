import { S3Client } from '@aws-sdk/client-s3';
import { AbstractLevelDOWN } from 'abstract-leveldown';

export interface S3LevelDown extends AbstractLevelDOWN<any, any> {}

interface S3LevelDownConstructor {
  /**
   * Create a S3LevelDown object to pass into levelup. E.g. `levelup(new S3LevelDOWN('mybucket')`.
   * @param {string} location Name of the S3 bucket with optional sub-folder. Example `mybucket` or `mybucket/folder`.
   * @param {S3} [s3] Optional S3 Client.
   */
  new (location: string, s3?: S3Client): S3LevelDown;
}

declare var S3LevelDown: S3LevelDownConstructor;

export default S3LevelDown;
