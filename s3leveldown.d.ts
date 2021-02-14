import { S3 } from 'aws-sdk';
import { AbstractLevelDOWN } from 'abstract-leveldown';

export interface S3LevelDOWN extends AbstractLevelDOWN<any, any> {}

interface S3LevelDOWNConstructor {
  /**
   * Create a S3LevelDOWN object to pass into levelup. E.g. `levelup(new S3LevelDOWN('mybucket')`.
   * @param {string} location Name of the S3 bucket with optional sub-folder. Example `mybucket` or `mybucket/folder`.
   * @param {S3} [s3] Optional S3 Client.
   */
  new (location: string, s3?: S3): S3LevelDOWN;
  /**
   * Create a S3LevelDOWN object to pass into levelup. E.g. `levelup(s3leveldown('mybucket')`.
   * @param {string} location Name of the S3 bucket with optional sub-folder. Example `mybucket` or `mybucket/folder`.
   * @param {S3} [s3] Optional S3 Client.
   * @returns {S3LevelDOWN} S3LevelDOWN to pass into `levelup`.
   */
  (location: string, s3?: S3): S3LevelDOWN;
}

declare var S3LevelDOWN: S3LevelDOWNConstructor;

export default S3LevelDOWN;
