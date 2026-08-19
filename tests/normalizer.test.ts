import { describe, expect, it } from 'vitest';

import { normalizeTweet } from '../src/normalizer.js';

describe('normalizeTweet', () => {
  it('produces the exact output contract with strings, timestamps, entities, and nulls', () => {
    const result = normalizeTweet(
      {
        rest_id: 123,
        core: {
          user_results: {
            result: {
              rest_id: 456,
              is_blue_verified: true,
              legacy: {
                screen_name: 'apify',
                name: 'Apify',
                followers_count: 1000,
                friends_count: 50,
                verified: false,
              },
            },
          },
        },
        legacy: {
          full_text: 'Hello #Apify https://t.co/abc &amp; more',
          lang: 'en',
          created_at: 'Wed Aug 19 12:00:00 +0000 2026',
          conversation_id_str: '123',
          in_reply_to_status_id_str: null,
          quoted_status_id_str: '99',
          favorite_count: 12,
          retweet_count: 3,
          reply_count: 2,
          quote_count: 1,
          source: null,
          entities: {
            hashtags: [{ text: 'Apify' }],
            user_mentions: [{ screen_name: 'someone' }],
            urls: [{ url: 'https://t.co/abc', expanded_url: 'https://apify.com' }],
          },
          extended_entities: {
            media: [
              { type: 'photo', media_url_https: 'https://img.example/photo.jpg' },
              {
                type: 'video',
                media_url_https: 'https://img.example/thumb.jpg',
                video_info: {
                  variants: [
                    {
                      content_type: 'video/mp4',
                      bitrate: 256000,
                      url: 'https://video.example/low.mp4',
                    },
                    {
                      content_type: 'video/mp4',
                      bitrate: 832000,
                      url: 'https://video.example/high.mp4',
                    },
                  ],
                },
              },
            ],
          },
        },
        views: { count: '5000' },
      },
      '2026-08-19T12:01:00.000Z',
    );

    expect(result).toEqual({
      id: '123',
      url: 'https://x.com/apify/status/123',
      text: 'Hello #Apify https://apify.com & more',
      lang: 'en',
      createdAt: '2026-08-19T12:00:00.000Z',
      conversationId: '123',
      isReply: false,
      isRetweet: false,
      isQuote: true,
      inReplyToId: null,
      quotedTweetId: '99',
      author: {
        id: '456',
        username: 'apify',
        name: 'Apify',
        verified: true,
        followers: 1000,
        following: 50,
      },
      metrics: {
        likes: 12,
        retweets: 3,
        replies: 2,
        quotes: 1,
        bookmarks: null,
        views: 5000,
      },
      entities: {
        hashtags: ['Apify'],
        mentions: ['someone'],
        urls: ['https://apify.com'],
        media: [
          {
            type: 'photo',
            url: 'https://img.example/photo.jpg',
            thumbnail: null,
          },
          {
            type: 'video',
            url: 'https://video.example/high.mp4',
            thumbnail: 'https://img.example/thumb.jpg',
          },
        ],
      },
      source: null,
      scrapedAt: '2026-08-19T12:01:00.000Z',
    });
    expect(Object.keys(result ?? {})).toHaveLength(16);
  });

  it('rejects records missing required tweet or author identity', () => {
    expect(normalizeTweet({ rest_id: '1', legacy: { created_at: 'invalid' } })).toBeNull();
  });
});
