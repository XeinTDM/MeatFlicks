<script lang="ts">
  import { faFacebookF, faTwitter, faInstagram } from '@fortawesome/free-brands-svg-icons';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<footer id="footer" class="bg-bg-color px-12 pt-12 transition-colors duration-400">
  <div class="border-border-color grid grid-cols-1 gap-8 border-b pb-12 md:grid-cols-3 lg:grid-cols-4">
    <div class="footer-socials">
      <span
        class="text-text-color mb-4 inline-block text-2xl font-bold tracking-tighter"
      >
        Prism
      </span>
      <div class="flex space-x-4">
        <a
          href="https://facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-text-color hover:text-primary-color text-xl transition-colors duration-300"
        >
          <FontAwesomeIcon icon={faFacebookF} />
        </a>
        <a
          href="https://twitter.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-text-color hover:text-primary-color text-xl transition-colors duration-300"
        >
          <FontAwesomeIcon icon={faTwitter} />
        </a>
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-text-color hover:text-primary-color text-xl transition-colors duration-300"
        >
          <FontAwesomeIcon icon={faInstagram} />
        </a>
      </div>
    </div>

    <div class="footer-links">
      <h4 class="text-text-color mb-4 text-lg font-medium">Explore</h4>
      <ul>
        <li class="mb-3">
          <a
            href="/"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Home
          </a>
        </li>
        <li class="mb-3">
          <a
            href="/movies"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Movies
          </a>
        </li>
        <li class="mb-3">
          <a
            href="/categories"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Categories
          </a>
        </li>
        <li class="mb-3">
          <a
            href="/search"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Search
          </a>
        </li>
      </ul>
    </div>

    <div class="footer-links">
      <h4 class="text-text-color mb-4 text-lg font-medium">Legal</h4>
      <ul>
        <li class="mb-3">
          <a
            href="/privacy-policy"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Privacy Policy
          </a>
        </li>
        <li class="mb-3">
          <a
            href="/terms-of-service"
            class="text-text-color hover:text-primary-color transition-colors duration-300"
          >
            Terms of Service
          </a>
        </li>
      </ul>
    </div>

    <div class="footer-disclaimer">
      <h4 class="text-text-color mb-4 text-lg font-medium">Disclaimer</h4>
      <p class="text-text-color text-sm leading-relaxed">
        This site does not store any files on our server.
      </p>
    </div>
  </div>

  <div class="text-text-color py-6 text-center text-sm">
    &copy; 2025 MeatFlicks. All Rights Reserved.
  </div>
</footer>
