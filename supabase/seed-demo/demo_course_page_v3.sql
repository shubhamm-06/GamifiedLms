-- =====================================================================
-- Demo data for the course page v3 review (migration 037 columns only).
--
-- Idempotent: plain UPDATEs that SET the three columns to fixed values, so running
-- it twice leaves the same rows. Touches only the "Demo:" courses, matched by slug
-- AND title prefix; non-demo courses are never touched. Every testimonial is
-- attributed to "Sample parent" so none can be mistaken for real feedback.
-- Testimonials v2 (migration 039): no ratings; `source` (an icon on the card) with an optional
-- `post_url`; a deliberately broken photo URL on two reviews (the photo must vanish).
-- Testimonials v2 (migration 039): no ratings; `source` (an icon on the card) with an optional
-- `post_url`; a deliberately broken photo URL on two reviews (the photo must vanish).
-- Undo: demo_course_page_v3_cleanup.sql (resets the three columns to defaults).
-- "Demo: Bare Minimum" is deliberately left out: it must stay minimal.
-- =====================================================================

-- Phonics Starter: 3 reviews, one custom text section, custom "How it works" rules,
-- button label "Join the course".
update public.courses set
  testimonials = '[
    {"quote": "My daughter asks to do her sounds lesson every evening now. The short videos are just the right length.", "name": "Sample parent", "relation": "Parent of a 5 year old", "source": "instagram", "post_url": "https://example.com/review/phonics-1"},
    {"quote": "We liked that the quizzes can be tried again without any fuss. She never felt she had failed.", "name": "Sample parent", "relation": "Parent of a 6 year old", "source": "whatsapp"},
    {"quote": "Simple to set up and easy to follow. I could see exactly which sounds he had covered.", "name": "Sample parent", "relation": "Parent of a 5 year old"}
  ]'::jsonb,
  page_layout = '[
    {"key": "about", "visible": true},
    {"key": "custom", "id": "demo-phonics-note", "type": "text", "visible": true, "title": "A note for parents",
     "body": "Phonics works best in small, regular doses. Ten minutes a day is plenty.\n\nIf your child gets stuck on a sound, let them replay the video. There is no rush and nothing is timed against them."},
    {"key": "learn", "visible": true},
    {"key": "inside", "visible": true},
    {"key": "how", "visible": true},
    {"key": "need", "visible": true},
    {"key": "reviews", "visible": true},
    {"key": "made_by", "visible": true},
    {"key": "faq", "visible": true}
  ]'::jsonb,
  page_options = '{
    "cta_label": "Join the course",
    "how_items": [
      "One new sound at a time, in a set order.",
      "Every lesson ends with a quick listening check.",
      "Checks can be retried as often as your child likes.",
      "Progress saves automatically on every device."
    ]
  }'::jsonb
where slug = 'demo-phonics-starter' and title like 'Demo:%';

-- Little Scientists: 6 reviews (grid at maximum), a custom list above the FAQ,
-- 2 custom facts, reviews moved before "What's inside", outline shows sections only.
update public.courses set
  testimonials = '[
    {"quote": "The experiments use things we already had at home. My son now narrates everything he does in the kitchen.", "name": "Sample parent", "relation": "Parent of a 7 year old", "source": "google", "post_url": "https://example.com/review/1"},
    {"quote": "Clear, calm videos. I appreciated that nothing felt rushed or loud.", "name": "Sample parent", "relation": "Parent of a 6 year old", "source": "facebook"},
    {"quote": "She keeps a little notebook of her results now. That was entirely her idea.", "name": "Sample parent", "relation": "Parent of an 8 year old", "source": "youtube", "post_url": "https://example.com/review/3"},
    {"quote": "Good balance of watching and doing. The quizzes were short enough to keep his attention.", "name": "Sample parent", "relation": "Parent of a 7 year old", "source": "instagram"},
    {"quote": "We did two lessons a week and finished comfortably within the access period.", "name": "Sample parent", "relation": "Parent of a 6 year old"},
    {"quote": "A gentle introduction to asking why. Exactly what I was looking for.", "name": "Sample parent", "relation": "Parent of a 7 year old", "photo_url": "https://example.com/missing-photo.jpg"}
  ]'::jsonb,
  page_layout = '[
    {"key": "about", "visible": true},
    {"key": "learn", "visible": true},
    {"key": "reviews", "visible": true},
    {"key": "inside", "visible": true},
    {"key": "how", "visible": true},
    {"key": "need", "visible": true},
    {"key": "made_by", "visible": true},
    {"key": "custom", "id": "demo-scientists-safety", "type": "list", "visible": true, "title": "Safety first",
     "items": ["Every experiment uses everyday, child-safe materials.", "Steps that need a grown-up are clearly marked.", "Nothing involves heat, sharp tools or chemicals."],
     "list_style": "check"},
    {"key": "faq", "visible": true}
  ]'::jsonb,
  page_options = '{
    "custom_facts": [{"label": "Level", "value": "Beginner"}, {"label": "Pace", "value": "2 lessons a week"}],
    "outline": {"detail": "sections"}
  }'::jsonb
where slug = 'demo-little-scientists' and title like 'Demo:%';

-- Creative Drawing: one review (the single-quote layout), cover hidden.
update public.courses set
  testimonials = '[
    {"quote": "He used to say he could not draw. After the shapes lessons he fills a page every afternoon, and he is proud of every one.", "name": "Sample parent", "relation": "Parent of a 6 year old", "source": "google"}
  ]'::jsonb,
  page_layout = '[]'::jsonb,
  page_options = '{"cover": {"show": false, "focus": "center"}}'::jsonb
where slug = 'demo-creative-drawing' and title like 'Demo:%';

-- Long Content Stress Test: a custom image with a BROKEN image link (the section must
-- disappear on load failure), a long review, and enough facts to hit the cap of 6.
update public.courses set
  testimonials = '[
    {"quote": "This is a deliberately lengthy review used to test wrapping. It goes on for a while so that it fills the full allowed length and shows how a block of text sits inside a card on a narrow phone and on a wide laptop screen. This last line ends exactly on the limit of 280 characters.", "name": "Sample parent with a long name that is used to test wrapping", "relation": "Parent of a child in a very long relation line used to check wrapping", "photo_url": "https://example.com/missing-photo.jpg", "source": "facebook", "post_url": "https://example.com/review/stress-1"},
    {"quote": "A second, shorter review so the grid layout is used.", "name": "Sample parent"}
  ]'::jsonb,
  page_layout = '[
    {"key": "about", "visible": true},
    {"key": "custom", "id": "demo-stress-image", "type": "image", "visible": true, "title": "A look inside",
     "image_url": "https://broken.invalid/demo-stress-image.png", "alt": "A screenshot of a lesson", "caption": "This image link is broken on purpose."},
    {"key": "learn", "visible": true},
    {"key": "inside", "visible": true},
    {"key": "how", "visible": true},
    {"key": "need", "visible": true},
    {"key": "reviews", "visible": true},
    {"key": "made_by", "visible": true},
    {"key": "faq", "visible": true}
  ]'::jsonb,
  page_options = '{
    "custom_facts": [{"label": "Level", "value": "All levels"}, {"label": "Certificate", "value": "Not included"}, {"label": "Support", "value": "Email, weekdays"}]
  }'::jsonb
where slug = 'demo-long-content-stress-test' and title like 'Demo:%';
